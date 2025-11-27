import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { AiService } from '../../lib/ai/ai.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService, AiService],
  imports: [AuthModule],
})
export class ChatbotModule {}

