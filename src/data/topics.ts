import { GradeLevel, TopicInfo } from '../types/quiz';

export interface TextbookMeta {
  grade: GradeLevel;
  bookTitle: string;
  series: string;
  chapterCount: number;
  lessonCount: number;
  summary: string;
  pdfPath: string;
}

export const TEXTBOOKS: TextbookMeta[] = [
  {
    grade: 'Công nghệ 10',
    bookTitle: 'Công nghệ Trồng trọt',
    series: 'Kết nối tri thức với cuộc sống',
    chapterCount: 8,
    lessonCount: 28,
    summary:
      'Đất trồng, giá thể, phân bón vi sinh, công nghệ giống, phòng trừ sâu bệnh hại, thu hoạch bảo quản, trồng trọt công nghệ cao và bảo vệ môi trường.',
    pdfPath: '/assets/aistudio/SGK_CN_10_77021431.pdf',
  },
  {
    grade: 'Công nghệ 11',
    bookTitle: 'Công nghệ Chăn nuôi',
    series: 'Kết nối tri thức với cuộc sống',
    chapterCount: 6,
    lessonCount: 22,
    summary:
      'Phương thức chăn nuôi, công nghệ chọn và nhân giống vật nuôi, thức ăn và nhu cầu dinh dưỡng, phòng trị bệnh, VietGAP, chăn nuôi công nghệ cao và xử lí chất thải.',
    pdfPath: '/assets/aistudio/SGK_CN11_02e6d51c.pdf',
  },
  {
    grade: 'Công nghệ 12',
    bookTitle: 'Lâm nghiệp – Thuỷ sản',
    series: 'Kết nối tri thức với cuộc sống',
    chapterCount: 10,
    lessonCount: 27,
    summary:
      'Trồng, chăm sóc, bảo vệ và khai thác tài nguyên rừng bền vững; môi trường nước, công nghệ giống, thức ăn, nuôi RAS/Biofloc, phòng trị bệnh và bảo vệ nguồn lợi thuỷ sản.',
    pdfPath: '/assets/aistudio/SGK_CN12_09cec449.pdf',
  },
];

export const TOPICS: TopicInfo[] = [
  // Công nghệ 10 - Công nghệ Trồng trọt (8 Chương)
  {
    id: 'cn10-c1',
    code: 'Chương I',
    title: 'Giới thiệu chung về trồng trọt',
    shortTitle: 'CN10 · Ch.I: Giới thiệu trồng trọt',
    grade: 'Công nghệ 10',
    lessons: 'Bài 1 – 2',
  },
  {
    id: 'cn10-c2',
    code: 'Chương II',
    title: 'Đất trồng & Giá thể trồng cây',
    shortTitle: 'CN10 · Ch.II: Đất trồng & Giá thể',
    grade: 'Công nghệ 10',
    lessons: 'Bài 3 – 6',
  },
  {
    id: 'cn10-c3',
    code: 'Chương III',
    title: 'Phân bón & Công nghệ vi sinh',
    shortTitle: 'CN10 · Ch.III: Phân bón',
    grade: 'Công nghệ 10',
    lessons: 'Bài 7 – 10',
  },
  {
    id: 'cn10-c4',
    code: 'Chương IV',
    title: 'Công nghệ giống cây trồng',
    shortTitle: 'CN10 · Ch.IV: Giống cây trồng',
    grade: 'Công nghệ 10',
    lessons: 'Bài 11 – 14',
  },
  {
    id: 'cn10-c5',
    code: 'Chương V',
    title: 'Phòng trừ sâu, bệnh hại cây trồng',
    shortTitle: 'CN10 · Ch.V: Sâu, bệnh hại',
    grade: 'Công nghệ 10',
    lessons: 'Bài 15 – 18',
  },
  {
    id: 'cn10-c6',
    code: 'Chương VI',
    title: 'Kĩ thuật trồng trọt, bảo quản & chế biến',
    shortTitle: 'CN10 · Ch.VI: Kĩ thuật trồng trọt',
    grade: 'Công nghệ 10',
    lessons: 'Bài 19 – 22',
  },
  {
    id: 'cn10-c7',
    code: 'Chương VII',
    title: 'Trồng trọt công nghệ cao',
    shortTitle: 'CN10 · Ch.VII: Trồng trọt CNC',
    grade: 'Công nghệ 10',
    lessons: 'Bài 23 – 25',
  },
  {
    id: 'cn10-c8',
    code: 'Chương VIII',
    title: 'Bảo vệ môi trường trong trồng trọt',
    shortTitle: 'CN10 · Ch.VIII: Môi trường trồng trọt',
    grade: 'Công nghệ 10',
    lessons: 'Bài 26 – 28',
  },

  // Công nghệ 11 - Công nghệ Chăn nuôi (6 Chương)
  {
    id: 'cn11-c1',
    code: 'Chương I',
    title: 'Giới thiệu chung về chăn nuôi',
    shortTitle: 'CN11 · Ch.I: Giới thiệu chăn nuôi',
    grade: 'Công nghệ 11',
    lessons: 'Bài 1 – 2',
  },
  {
    id: 'cn11-c2',
    code: 'Chương II',
    title: 'Công nghệ giống vật nuôi',
    shortTitle: 'CN11 · Ch.II: Giống vật nuôi',
    grade: 'Công nghệ 11',
    lessons: 'Bài 3 – 6',
  },
  {
    id: 'cn11-c3',
    code: 'Chương III',
    title: 'Công nghệ thức ăn chăn nuôi',
    shortTitle: 'CN11 · Ch.III: Thức ăn chăn nuôi',
    grade: 'Công nghệ 11',
    lessons: 'Bài 7 – 10',
  },
  {
    id: 'cn11-c4',
    code: 'Chương IV',
    title: 'Phòng, trị bệnh cho vật nuôi',
    shortTitle: 'CN11 · Ch.IV: Phòng, trị bệnh',
    grade: 'Công nghệ 11',
    lessons: 'Bài 11 – 15',
  },
  {
    id: 'cn11-c5',
    code: 'Chương V',
    title: 'Công nghệ chăn nuôi & VietGAP',
    shortTitle: 'CN11 · Ch.V: Công nghệ chăn nuôi',
    grade: 'Công nghệ 11',
    lessons: 'Bài 16 – 20',
  },
  {
    id: 'cn11-c6',
    code: 'Chương VI',
    title: 'Bảo vệ môi trường trong chăn nuôi',
    shortTitle: 'CN11 · Ch.VI: Môi trường chăn nuôi',
    grade: 'Công nghệ 11',
    lessons: 'Bài 21 – 22',
  },

  // Công nghệ 12 - Lâm nghiệp - Thuỷ sản (10 Chương)
  {
    id: 'cn12-c1',
    code: 'Chương I',
    title: 'Giới thiệu chung về lâm nghiệp',
    shortTitle: 'CN12 · Ch.I: Giới thiệu lâm nghiệp',
    grade: 'Công nghệ 12',
    lessons: 'Bài 1 – 2',
  },
  {
    id: 'cn12-c2',
    code: 'Chương II',
    title: 'Trồng và chăm sóc rừng',
    shortTitle: 'CN12 · Ch.II: Trồng & chăm sóc rừng',
    grade: 'Công nghệ 12',
    lessons: 'Bài 3 – 5',
  },
  {
    id: 'cn12-c3',
    code: 'Chương III',
    title: 'Bảo vệ và khai thác tài nguyên rừng bền vững',
    shortTitle: 'CN12 · Ch.III: Bảo vệ & khai thác rừng',
    grade: 'Công nghệ 12',
    lessons: 'Bài 6 – 7',
  },
  {
    id: 'cn12-c4',
    code: 'Chương IV',
    title: 'Giới thiệu chung về thuỷ sản',
    shortTitle: 'CN12 · Ch.IV: Giới thiệu thuỷ sản',
    grade: 'Công nghệ 12',
    lessons: 'Bài 8 – 9',
  },
  {
    id: 'cn12-c5',
    code: 'Chương V',
    title: 'Môi trường nuôi thuỷ sản',
    shortTitle: 'CN12 · Ch.V: Môi trường thuỷ sản',
    grade: 'Công nghệ 12',
    lessons: 'Bài 10 – 12',
  },
  {
    id: 'cn12-c6',
    code: 'Chương VI',
    title: 'Công nghệ giống thuỷ sản',
    shortTitle: 'CN12 · Ch.VI: Giống thuỷ sản',
    grade: 'Công nghệ 12',
    lessons: 'Bài 13 – 15',
  },
  {
    id: 'cn12-c7',
    code: 'Chương VII',
    title: 'Công nghệ thức ăn thuỷ sản',
    shortTitle: 'CN12 · Ch.VII: Thức ăn thuỷ sản',
    grade: 'Công nghệ 12',
    lessons: 'Bài 16 – 18',
  },
  {
    id: 'cn12-c8',
    code: 'Chương VIII',
    title: 'Công nghệ nuôi thuỷ sản (VietGAP, RAS, Biofloc)',
    shortTitle: 'CN12 · Ch.VIII: Công nghệ nuôi TS',
    grade: 'Công nghệ 12',
    lessons: 'Bài 19 – 22',
  },
  {
    id: 'cn12-c9',
    code: 'Chương IX',
    title: 'Phòng, trị bệnh thuỷ sản',
    shortTitle: 'CN12 · Ch.IX: Phòng, trị bệnh TS',
    grade: 'Công nghệ 12',
    lessons: 'Bài 23 – 25',
  },
  {
    id: 'cn12-c10',
    code: 'Chương X',
    title: 'Bảo vệ và khai thác nguồn lợi thuỷ sản',
    shortTitle: 'CN12 · Ch.X: Nguồn lợi thuỷ sản',
    grade: 'Công nghệ 12',
    lessons: 'Bài 26 – 27',
  },
];
