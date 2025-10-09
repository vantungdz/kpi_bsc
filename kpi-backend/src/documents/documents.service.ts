import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { Employee } from '../employees/entities/employee.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  async create(createDocumentDto: CreateDocumentDto): Promise<Document> {
    const { createdById, ...rest } = createDocumentDto;
    const doc = this.documentRepository.create(rest);
    if (createdById) {
      const employee = await this.employeeRepository.findOne({
        where: { id: createdById },
      });
      if (employee) doc.createdBy = employee;
    }
    return this.documentRepository.save(doc);
  }

  async findAll(): Promise<Document[]> {
    return this.documentRepository.find({ relations: ['createdBy'] });
  }

  async findOne(id: number): Promise<Document> {
    const doc = await this.documentRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async update(
    id: number,
    updateDocumentDto: UpdateDocumentDto,
  ): Promise<Document> {
    await this.documentRepository.update(id, updateDocumentDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const document = await this.findOne(id);
    if (document.filePath) {
      const filePath = path.resolve(document.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await this.documentRepository.delete(id);
  }

  async uploadDocument(
    file: Express.Multer.File,
    body: Record<string, any>,
    user: any,
  ): Promise<Document> {
    const createDto: CreateDocumentDto = {
      name:
        typeof body.name === 'string' && body.name.trim()
          ? body.name
          : file.originalname,
      description:
        typeof body.description === 'string' ? body.description : undefined,
      filePath: file.path,
      type:
        typeof body.type === 'string' && body.type.trim()
          ? body.type
          : 'general',
      createdById: typeof user?.id === 'number' ? user.id : undefined,
    };
    return this.create(createDto);
  }
}
