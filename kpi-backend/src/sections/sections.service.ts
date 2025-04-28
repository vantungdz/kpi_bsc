// src/sections/section.service.ts
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Section } from 'src/entities/section.entity'; // Đảm bảo entity này có quan hệ với Department
import { Department } from 'src/entities/department.entity'; // Import Department nếu cần cho type hinting
// Bỏ import các entity/module không dùng đến nếu có (ví dụ KPIAssignment, IsNull, Not)
import { Repository } from 'typeorm';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    // Bỏ repository không dùng nếu có (ví dụ kpiAssignmentRepository)
  ) {}

  // Phương thức create giữ nguyên như ban đầu của bạn
  async create(createSectionDto: Section): Promise<Section> {
    const section = this.sectionRepository.create(createSectionDto);

    // Cân nhắc dùng Exception khác phù hợp hơn nếu việc create bị lỗi,
    // UnauthorizedException thường dùng cho lỗi xác thực/quyền
    if (!section) {
      // Ví dụ: throw new BadRequestException('Invalid section data');
      throw new UnauthorizedException('Invalid credentials'); // Giữ lại lỗi gốc của bạn nếu có lý do đặc biệt
    }
    // Bạn có thể cần gọi sectionRepository.save(section) ở đây để lưu vào DB
    // return section;
    return this.sectionRepository.save(section); // Giả sử cần save
  }

  // Phương thức findAll giữ nguyên (nhưng có thể cũng cần thêm relations nếu muốn lấy department)
  async findAll(): Promise<Section[]> {
    // Nếu muốn findAll cũng có thông tin department, thêm relations ở đây:
    // return this.sectionRepository.find({ relations: ['department'] });
    return this.sectionRepository.find({ relations: ['department'] }); // Thêm relations cho nhất quán
  }

  // Phương thức findOne đã sửa để thêm relations
  async findOne(id: number): Promise<Section> {
    const section = await this.sectionRepository.findOne({
      where: { id },
      relations: ['department'], // <-- Đã thêm relations
    });

    if (!section) {
      // Nên dùng NotFoundException
      throw new NotFoundException(`Section with ID ${id} not found`);
    }
    return section;
  }

  // Phương thức getFilteredSections đã sửa đổi và đơn giản hóa
  /**
   * Lấy danh sách sections, có thể lọc theo departmentId.
   * Luôn tải kèm thông tin department liên quan.
   * @param departmentId ID của department để lọc (tùy chọn)
   * @returns Promise<Section[]> Danh sách sections kèm thông tin department
   */
  async getFilteredSections(departmentId?: number): Promise<Section[]> {
    let sections: Section[] = [];
    const relationsToLoad = ['department']; // Luôn tải kèm department relation

    if (departmentId) {
      // Lọc theo departmentId
      console.log(
        `[SectionsService] Finding sections with departmentId: ${departmentId}`,
      );
      sections = await this.sectionRepository.find({
        where: { department: { id: departmentId } }, // Lọc qua quan hệ
        relations: relationsToLoad, // Tải kèm department
      });
    } else {
      // Không có bộ lọc - Lấy TẤT CẢ sections
      console.log(`[SectionsService] Finding all sections`);
      sections = await this.sectionRepository.find({
        relations: relationsToLoad, // ***** Đảm bảo tải kèm department *****
      });
    }

    console.log(`[SectionsService] Returning ${sections.length} sections.`);
    // Các section trả về giờ sẽ chứa object 'department' lồng vào
    return sections;
  }
}
