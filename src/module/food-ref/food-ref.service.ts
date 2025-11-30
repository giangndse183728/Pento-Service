import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../lib/prisma/prisma.service';

@Injectable()
export class FoodRefService {
  private readonly logger = new Logger(FoodRefService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(sort?: 'alpha' | 'newest') {
    try {
      const orderBy: Prisma.food_referencesOrderByWithRelationInput =
        sort === 'newest'
          ? { created_on_utc: 'desc' }
          : { name: 'asc' };

      return await this.prisma.food_references.findMany({
        where: {
          is_deleted: false,
        },
        orderBy,
      });
    } catch (error) {
      this.logger.error('Error fetching food references', error);
      throw new InternalServerErrorException('Failed to fetch food references');
    }
  }

  async findOne(id: string) {
    try {
      const foodRef = await this.prisma.food_references.findFirst({
        where: {
          id,
          is_deleted: false,
        },
      });

      if (!foodRef) {
        throw new NotFoundException(`Food reference with ID ${id} not found`);
      }

      return foodRef;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error fetching food reference ${id}`, error);
      throw new InternalServerErrorException('Failed to fetch food reference');
    }
  }

  async search(query: string) {
    try {
      return await this.prisma.food_references.findMany({
        where: {
          is_deleted: false,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { barcode: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: {
          name: 'asc',
        },
        take: 50,
      });
    } catch (error) {
      this.logger.error(`Error searching food references with query: ${query}`, error);
      throw new InternalServerErrorException('Failed to search food references');
    }
  }
}

