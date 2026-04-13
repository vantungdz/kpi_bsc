import { Module } from '@nestjs/common';
import { PerspectiveService } from './perspective.service';
import { PerspectiveController } from './perspective.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Perspective } from 'src/perspective/entities/perspective.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Perspective])],
  providers: [PerspectiveService],
  controllers: [PerspectiveController],
})
export class PerspectiveModule {}
