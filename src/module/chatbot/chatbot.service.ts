import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AiService } from '../../lib/ai/ai.service';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly prismaService: PrismaService,
  ) {}

  async chat(request: ChatRequestDto, userId?: string) {
    await this.ensureFeatureAvailable('AI_CHEF', userId);

    // Get nearly expired food items for context
    const nearlyExpiredItems = await this.getNearlyExpiredItems(userId);
    
    // Build enhanced message with context
    const enhancedMessage = this.buildEnhancedMessage(
      request.message,
      nearlyExpiredItems,
    );

    const result = await this.aiService.chat(enhancedMessage);

    await this.incrementUsage('AI_CHEF', userId);

    return result;
  }

  private async ensureFeatureAvailable(
    featureCode: string,
    userId?: string,
  ): Promise<void> {
    if (!userId) {
      throw new ForbiddenException('User context is required');
    }

    this.logger.debug(
      `Checking entitlement for userId: ${userId}, featureCode: ${featureCode}`,
    );

    const entitlement = await this.prismaService.user_entitlements.findFirst({
      where: {
        user_id: userId,
        feature_code: featureCode,
      },
    });

    if (!entitlement) {
      // Debug: Check if user has any entitlements at all
      const allUserEntitlements =
        await this.prismaService.user_entitlements.findMany({
          where: {
            user_id: userId,
          },
          select: {
            feature_code: true,
            user_id: true,
          },
        });

      this.logger.warn(
        `No entitlement found. UserId: ${userId}, FeatureCode: ${featureCode}. User's entitlements: ${JSON.stringify(allUserEntitlements)}`,
      );

      throw new ForbiddenException('Feature not available for this user');
    }

    this.logger.debug(
      `Entitlement found: ${JSON.stringify({ quota: entitlement.quota, usage_count: entitlement.usage_count })}`,
    );
  }


  private async incrementUsage(
    featureCode: string,
    userId?: string,
  ): Promise<void> {
    if (!userId) return;

    await this.prismaService.user_entitlements.updateMany({
      where: {
        user_id: userId,
        feature_code: featureCode,
      },
      data: {
        usage_count: { increment: 1 },
      },
    });
  }

  private async getNearlyExpiredItems(userId?: string) {
    if (!userId) return [];

    try {
      // Get user's household_id
      const user = await this.prismaService.users.findUnique({
        where: { id: userId },
        select: { household_id: true },
      });

      if (!user?.household_id) {
        this.logger.debug(`User ${userId} has no household_id`);
        return [];
      }

      // Calculate date 7 days from now (normalize to start of day to avoid timezone issues)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(today.getDate() + 7);
      sevenDaysFromNow.setHours(23, 59, 59, 999);

      // Query for nearly expired items (expiring within 7 days, not expired yet)
      const items = await this.prismaService.food_items.findMany({
        where: {
          household_id: user.household_id,
          is_deleted: false,
          expiration_date: {
            gte: today,
            lte: sevenDaysFromNow,
          },
        },
        take: 6,
        orderBy: {
          expiration_date: 'asc',
        },
        include: {
          food_references: {
            select: {
              name: true,
              food_group: true,
              typical_shelf_life_days_pantry: true,
              typical_shelf_life_days_fridge: true,
              typical_shelf_life_days_freezer: true,
            },
          },
          units: {
            select: {
              name: true,
              abbreviation: true,
            },
          },
        },
      });

      this.logger.debug(
        `Found ${items.length} nearly expired items for user ${userId}`,
      );

      return items;
    } catch (error) {
      this.logger.error(
        `Error fetching nearly expired items: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  private buildEnhancedMessage(
    originalMessage: string,
    nearlyExpiredItems: Array<{
      id: string;
      name: string;
      quantity: any;
      expiration_date: Date;
      food_references: {
        name: string;
        food_group: string;
        typical_shelf_life_days_pantry: number;
        typical_shelf_life_days_fridge: number;
        typical_shelf_life_days_freezer: number;
      };
      units: {
        name: string;
        abbreviation: string;
      };
    }>,
  ): string {
    if (nearlyExpiredItems.length === 0) {
      return originalMessage;
    }

    const itemsContext = nearlyExpiredItems
      .map((item, index) => {
        // Handle expiration_date (could be Date object or string from Prisma)
        const expirationDate =
          item.expiration_date instanceof Date
            ? item.expiration_date
            : new Date(item.expiration_date);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiryDate = new Date(expirationDate);
        expiryDate.setHours(0, 0, 0, 0);
        
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        
        const expiryText =
          daysUntilExpiry === 0
            ? 'expires today'
            : daysUntilExpiry === 1
              ? 'expires tomorrow'
              : `expires in ${daysUntilExpiry} days`;

        return `${index + 1}. ${item.name} (${item.food_references.name}) - ${item.quantity} ${item.units.abbreviation || item.units.name} - ${expiryText} (Food Group: ${item.food_references.food_group})`;
      })
      .join('\n');

    const contextPrompt = `The user has the following items that are nearly expired:\n${itemsContext}\n\nPlease provide helpful suggestions such as recipes using these items, how to preserve them, or ways to use them before they expire. Be specific and practical in your suggestions.`;

    return `${contextPrompt}\n\nUser's question: ${originalMessage}`;
  }
}

