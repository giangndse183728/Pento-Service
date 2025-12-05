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
    await this.ensureEntitlementAvailable('AI_CHEF', userId);

    const result = await this.aiService.chat(request.message);

    await this.incrementUsage('AI_CHEF', userId);

    return result;
  }

  /**
   * Ensure user has entitlement and quota for the given feature.
   * Throws ForbiddenException if over quota or missing entitlement.
   * If quota is null, skip the check but still allow the operation.
   */
  private async ensureEntitlementAvailable(
    featureCode: string,
    userId?: string,
  ): Promise<void> {
    if (!userId) {
      // Guard should already enforce auth; double-check to avoid silent allow
      throw new ForbiddenException('User context is required');
    }

    const entitlement = await this.prismaService.user_entitlements.findFirst({
      where: {
        user_id: userId,
        feature_code: featureCode,
      },
    });

    if (!entitlement) {
      throw new ForbiddenException('Feature not available for this user');
    }

    const { quota, usage_count } = entitlement;

    // Only check quota if it's not null/undefined
    if (quota !== null && quota !== undefined && usage_count >= quota) {
      throw new ForbiddenException(
        `Quota exceeded for feature ${featureCode}. Usage: ${usage_count}/${quota}`,
      );
    }
  }

  /**
   * Increment entitlement usage after successful operation.
   * Always increments usage_count even if quota is null.
   */
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

