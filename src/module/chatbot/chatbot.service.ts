import { Injectable, Logger } from '@nestjs/common';
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
    const result = await this.aiService.chat(request.message);

    // Increment usage_count for tracking (no quota check - unlimited chat)
    await this.incrementUsage('AI_CHEF', userId);

    return result;
  }

  /**
   * Increment entitlement usage after successful operation.
   * No quota checking - chatbot is unlimited if quota is null.
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

