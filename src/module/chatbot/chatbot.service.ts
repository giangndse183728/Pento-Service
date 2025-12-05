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

    const result = await this.aiService.chat(request.message);

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
}

