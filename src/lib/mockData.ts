import type {
  Candidate, CandidateDocument, Agency, Employer, RecruitmentProgram,
  Contract, EmailLog, VisaStatus, NotificationItem, AuditEvent,
  STISpeaking, STITraining, STIInterview1, STIInterview2,
  ScoringModel, CandidateScore, User, ActivityItem,
  ExtractionField,
} from '@/types';

// ─── Programs ───────────────────────────────────────────────
export const mockPrograms: RecruitmentProgram[] = [
  { id: 'prog-1', program_name: 'Ausbildung Nursing' },
  { id: 'prog-2', program_name: 'Pflegefachkraft' },
  { id: 'prog-3', program_name: 'Hotel Management' },
  { id: 'prog-4', program_name: 'IT Specialist' },
  { id: 'prog-5', program_name: 'Construction Worker' },
];

// ─── Agencies ───────────────────────────────────────────────
export const mockAgencies: Agency[] = [
  { id: 'ag-1', agency_name: 'Global Talent Solutions', contact_person: 'Rajesh Kumar', contact_email: 'rajesh@gts.com', country: 'India', commission_rate: 8.5, status: 'active', created_at: '2024-01-15T08:00:00Z' },
  { id: 'ag-2', agency_name: 'European Workforce Ltd', contact_person: 'Maria Schmidt', contact_email: 'maria@ewl.de', country: 'Germany', commission_rate: 7.0, status: 'active', created_at: '2024-02-10T10:30:00Z' },
  { id: 'ag-3', agency_name: 'Asia Recruitment Hub', contact_person: 'Li Wei', contact_email: 'liwei@arh.cn', country: 'China', commission_rate: 9.0, status: 'active', created_at: '2024-03-05T14:15:00Z' },
  { id: 'ag-4', agency_name: 'Phillipines Staffing Co', contact_person: 'Ana Reyes', contact_email: 'ana@psc.ph', country: 'Philippines', commission_rate: 8.0, status: 'inactive', created_at: '2024-01-20T09:00:00Z' },
  { id: 'ag-5', agency_name: 'Vietnam Export Labor', contact_person: 'Minh Nguyen', contact_email: 'minh@vnel.vn', country: 'Vietnam', commission_rate: 7.5, status: 'active', created_at: '2024-04-12T11:00:00Z' },
  { id: 'ag-6', agency_name: 'Nepal Overseas Services', contact_person: 'Prakash Sharma', contact_email: 'prakash@nos.np', country: 'Nepal', commission_rate: 8.0, status: 'active', created_at: '2024-05-01T07:30:00Z' },
];

// ─── Employers ──────────────────────────────────────────────
export const mockEmployers: Employer[] = [
  { id: 'emp-1', name: 'Charite University Hospital', type: 'klinik', city: 'Berlin', country: 'Germany', contact_person: 'Dr. Hans Mueller', email: 'hans@charite.de', created_at: '2024-01-10T08:00:00Z' },
  { id: 'emp-2', name: 'Seniorenresidenz Rosenhof', type: 'pflegeheim', city: 'Munich', country: 'Germany', contact_person: 'Ingrid Weber', email: 'ingrid@rosenhof.de', created_at: '2024-02-15T09:30:00Z' },
  { id: 'emp-3', name: 'Klinikum Stuttgart', type: 'klinik', city: 'Stuttgart', country: 'Germany', contact_person: 'Dr. Klaus Meyer', email: 'klaus@klinikum-stuttgart.de', created_at: '2024-03-01T10:00:00Z' },
  { id: 'emp-4', name: 'Ausbildungszentrum Hamburg', type: 'ausbildung', city: 'Hamburg', country: 'Germany', contact_person: 'Sabine Fischer', email: 'sabine@azhamburg.de', created_at: '2024-04-20T11:00:00Z' },
];

// ─── Candidates ─────────────────────────────────────────────
export const mockCandidates: Candidate[] = [
  { candidate_id: 'cand-001', first_name: 'Priya', last_name: 'Sharma', dob: '1998-03-15', gender: 'female', country: 'India', email: 'priya.sharma@email.com', phone: '+91 98765 43210', highest_qualification: 'BSc Nursing', program_id: 'prog-2', program_name: 'Pflegefachkraft', source_type: 'agency', source_agency_id: 'ag-1', source_agency_name: 'Global Talent Solutions', assigned_recruiter_id: 'user-3', assigned_recruiter_name: 'Lisa Anderson', status: 'placed', gate_status: 'eligible', total_score: 87.5, rank: 1, created_at: '2024-06-01T08:00:00Z', updated_at: '2024-12-10T10:00:00Z' },
  { candidate_id: 'cand-002', first_name: 'Ahmed', last_name: 'Hassan', dob: '1996-07-22', gender: 'male', country: 'Egypt', email: 'ahmed.hassan@email.com', phone: '+20 100 234 5678', highest_qualification: 'Diploma in Hotel Management', program_id: 'prog-3', program_name: 'Hotel Management', source_type: 'internal', assigned_recruiter_id: 'user-3', assigned_recruiter_name: 'Lisa Anderson', status: 'interview2', gate_status: 'eligible', total_score: 82.3, rank: 2, created_at: '2024-06-05T09:30:00Z', updated_at: '2024-12-08T14:00:00Z' },
  { candidate_id: 'cand-003', first_name: 'Maria', last_name: 'Gonzalez', dob: '1997-11-08', gender: 'female', country: 'Philippines', email: 'maria.g@email.com', phone: '+63 912 345 6789', highest_qualification: 'BS Nursing', program_id: 'prog-1', program_name: 'Ausbildung Nursing', source_type: 'agency', source_agency_id: 'ag-4', source_agency_name: 'Phillipines Staffing Co', assigned_recruiter_id: 'user-4', assigned_recruiter_name: 'David Chen', status: 'visa', gate_status: 'eligible', total_score: 79.8, rank: 3, created_at: '2024-06-10T10:00:00Z', updated_at: '2024-12-09T11:30:00Z' },
  { candidate_id: 'cand-004', first_name: 'Chen', last_name: 'Wei', dob: '1999-01-30', gender: 'male', country: 'China', email: 'chen.wei@email.com', phone: '+86 138 0000 1234', highest_qualification: 'Bachelor of Computer Science', program_id: 'prog-4', program_name: 'IT Specialist', source_type: 'direct', assigned_recruiter_id: 'user-4', assigned_recruiter_name: 'David Chen', status: 'contract', gate_status: 'eligible', total_score: 91.2, rank: 4, created_at: '2024-06-12T08:00:00Z', updated_at: '2024-12-07T16:00:00Z' },
  { candidate_id: 'cand-005', first_name: 'Ananya', last_name: 'Patel', dob: '1998-05-20', gender: 'female', country: 'India', email: 'ananya.patel@email.com', phone: '+91 87654 32109', highest_qualification: 'BSc Nursing', program_id: 'prog-2', program_name: 'Pflegefachkraft', source_type: 'agency', source_agency_id: 'ag-1', source_agency_name: 'Global Talent Solutions', assigned_recruiter_id: 'user-3', assigned_recruiter_name: 'Lisa Anderson', status: 'interview1', gate_status: 'eligible', total_score: 76.4, rank: 5, created_at: '2024-06-15T09:00:00Z', updated_at: '2024-12-06T10:00:00Z' },
  { candidate_id: 'cand-006', first_name: 'Robert', last_name: 'Kowalski', dob: '1995-09-12', gender: 'male', country: 'Poland', email: 'robert.k@email.com', phone: '+48 501 234 567', highest_qualification: 'Master of Engineering', program_id: 'prog-4', program_name: 'IT Specialist', source_type: 'direct', assigned_recruiter_id: 'user-5', assigned_recruiter_name: 'Emma Wilson', status: 'shortlisted', gate_status: 'eligible', total_score: 85.1, rank: 6, created_at: '2024-06-18T11:00:00Z', updated_at: '2024-12-05T14:30:00Z' },
  { candidate_id: 'cand-007', first_name: 'Fatima', last_name: 'Al-Rashid', dob: '1997-04-05', gender: 'female', country: 'Morocco', email: 'fatima.ar@email.com', phone: '+212 600 123 456', highest_qualification: 'Diploma in Caregiving', program_id: 'prog-3', program_name: 'Hotel Management', source_type: 'agency', source_agency_id: 'ag-2', source_agency_name: 'European Workforce Ltd', assigned_recruiter_id: 'user-5', assigned_recruiter_name: 'Emma Wilson', status: 'waiting', gate_status: 'eligible', total_score: 72.6, rank: 7, created_at: '2024-06-20T08:30:00Z', updated_at: '2024-12-04T09:00:00Z' },
  { candidate_id: 'cand-008', first_name: 'Nguyen', last_name: 'Van Thanh', dob: '1996-12-18', gender: 'male', country: 'Vietnam', email: 'nguyen.vt@email.com', phone: '+84 90 123 4567', highest_qualification: 'BSc Construction Engineering', program_id: 'prog-5', program_name: 'Construction Worker', source_type: 'agency', source_agency_id: 'ag-5', source_agency_name: 'Vietnam Export Labor', assigned_recruiter_id: 'user-3', assigned_recruiter_name: 'Lisa Anderson', status: 'rejected', gate_status: 'not_placement_ready', total_score: 45.3, rank: undefined, created_at: '2024-06-22T10:00:00Z', updated_at: '2024-11-28T15:00:00Z' },
  { candidate_id: 'cand-009', first_name: 'Sunita', last_name: 'Devi', dob: '1998-08-25', gender: 'female', country: 'Nepal', email: 'sunita.devi@email.com', phone: '+977 980 123 4567', highest_qualification: 'PCL Nursing', program_id: 'prog-1', program_name: 'Ausbildung Nursing', source_type: 'agency', source_agency_id: 'ag-6', source_agency_name: 'Nepal Overseas Services', assigned_recruiter_id: 'user-4', assigned_recruiter_name: 'David Chen', status: 'interview1', gate_status: 'eligible', total_score: 80.5, rank: 8, created_at: '2024-06-25T07:00:00Z', updated_at: '2024-12-09T08:00:00Z' },
  { candidate_id: 'cand-010', first_name: 'James', last_name: 'O\'Brien', dob: '1994-02-14', gender: 'male', country: 'Ireland', email: 'james.obrien@email.com', phone: '+353 87 123 4567', highest_qualification: 'Bachelor of Business', program_id: 'prog-3', program_name: 'Hotel Management', source_type: 'internal', assigned_recruiter_id: 'user-5', assigned_recruiter_name: 'Emma Wilson', status: 'placed', gate_status: 'eligible', total_score: 88.9, rank: 9, created_at: '2024-06-28T09:00:00Z', updated_at: '2024-12-01T11:00:00Z' },
  { candidate_id: 'cand-011', first_name: 'Linh', last_name: 'Tran', dob: '1999-06-30', gender: 'female', country: 'Vietnam', email: 'linh.tran@email.com', phone: '+84 91 234 5678', highest_qualification: 'BSc Nursing', program_id: 'prog-2', program_name: 'Pflegefachkraft', source_type: 'agency', source_agency_id: 'ag-5', source_agency_name: 'Vietnam Export Labor', assigned_recruiter_id: 'user-3', assigned_recruiter_name: 'Lisa Anderson', status: 'interview2', gate_status: 'eligible', total_score: 83.7, rank: 10, created_at: '2024-07-01T08:00:00Z', updated_at: '2024-12-08T10:30:00Z' },
  { candidate_id: 'cand-012', first_name: 'Khaled', last_name: 'Mansour', dob: '1997-10-03', gender: 'male', country: 'Egypt', email: 'khaled.m@email.com', phone: '+20 101 345 6789', highest_qualification: 'Diploma in IT', program_id: 'prog-4', program_name: 'IT Specialist', source_type: 'direct', assigned_recruiter_id: 'user-4', assigned_recruiter_name: 'David Chen', status: 'shortlisted', gate_status: 'eligible', total_score: 78.2, rank: 11, created_at: '2024-07-05T10:30:00Z', updated_at: '2024-12-03T14:00:00Z' },
  { candidate_id: 'cand-013', first_name: 'Rosa', last_name: 'Silva', dob: '1996-03-22', gender: 'female', country: 'Philippines', email: 'rosa.silva@email.com', phone: '+63 917 456 7890', highest_qualification: 'BS Nursing', program_id: 'prog-2', program_name: 'Pflegefachkraft', source_type: 'agency', source_agency_id: 'ag-4', source_agency_name: 'Phillipines Staffing Co', assigned_recruiter_id: 'user-5', assigned_recruiter_name: 'Emma Wilson', status: 'visa', gate_status: 'eligible', total_score: 81.4, rank: 12, created_at: '2024-07-08T09:00:00Z', updated_at: '2024-12-07T11:00:00Z' },
  { candidate_id: 'cand-014', first_name: 'Wei', last_name: 'Liang', dob: '1998-07-17', gender: 'male', country: 'China', email: 'wei.liang@email.com', phone: '+86 139 5678 9012', highest_qualification: 'Bachelor of Civil Engineering', program_id: 'prog-5', program_name: 'Construction Worker', source_type: 'agency', source_agency_id: 'ag-3', source_agency_name: 'Asia Recruitment Hub', assigned_recruiter_id: 'user-3', assigned_recruiter_name: 'Lisa Anderson', status: 'waiting', gate_status: 'eligible', total_score: 74.8, rank: 13, created_at: '2024-07-10T08:00:00Z', updated_at: '2024-12-06T09:30:00Z' },
  { candidate_id: 'cand-015', first_name: 'Aisha', last_name: 'Mohammed', dob: '1999-11-11', gender: 'female', country: 'Morocco', email: 'aisha.m@email.com', phone: '+212 601 234 567', highest_qualification: 'BSc Nursing', program_id: 'prog-1', program_name: 'Ausbildung Nursing', source_type: 'agency', source_agency_id: 'ag-2', source_agency_name: 'European Workforce Ltd', assigned_recruiter_id: 'user-4', assigned_recruiter_name: 'David Chen', status: 'contract', gate_status: 'eligible', total_score: 86.3, rank: 14, created_at: '2024-07-12T11:00:00Z', updated_at: '2024-12-05T15:00:00Z' },
  { candidate_id: 'cand-016', first_name: 'Piotr', last_name: 'Nowak', dob: '1995-05-28', gender: 'male', country: 'Poland', email: 'piotr.nowak@email.com', phone: '+48 502 345 678', highest_qualification: 'Master of Computer Science', program_id: 'prog-4', program_name: 'IT Specialist', source_type: 'direct', assigned_recruiter_id: 'user-5', assigned_recruiter_name: 'Emma Wilson', status: 'interview1', gate_status: 'eligible', total_score: 89.5, rank: 15, created_at: '2024-07-15T09:00:00Z', updated_at: '2024-12-09T10:00:00Z' },
  { candidate_id: 'cand-017', first_name: 'Meera', last_name: 'Kumari', dob: '1998-01-08', gender: 'female', country: 'India', email: 'meera.k@email.com', phone: '+91 76543 21098', highest_qualification: 'BSc Nursing', program_id: 'prog-2', program_name: 'Pflegefachkraft', source_type: 'agency', source_agency_id: 'ag-1', source_agency_name: 'Global Talent Solutions', assigned_recruiter_id: 'user-3', assigned_recruiter_name: 'Lisa Anderson', status: 'withdrawn', gate_status: 'not_placement_ready', total_score: 65.2, rank: undefined, created_at: '2024-07-18T08:00:00Z', updated_at: '2024-11-15T12:00:00Z' },
  { candidate_id: 'cand-018', first_name: 'Samuel', last_name: 'Addo', dob: '1996-09-14', gender: 'male', country: 'Ghana', email: 'samuel.addo@email.com', phone: '+233 24 123 4567', highest_qualification: 'Diploma in Hospitality', program_id: 'prog-3', program_name: 'Hotel Management', source_type: 'internal', assigned_recruiter_id: 'user-5', assigned_recruiter_name: 'Emma Wilson', status: 'shortlisted', gate_status: 'eligible', total_score: 77.1, rank: 16, created_at: '2024-07-20T10:00:00Z', updated_at: '2024-12-02T14:00:00Z' },
  { candidate_id: 'cand-019', first_name: 'Bimala', last_name: 'Gurung', dob: '1997-04-02', gender: 'female', country: 'Nepal', email: 'bimala.g@email.com', phone: '+977 981 234 5678', highest_qualification: 'PCL Nursing', program_id: 'prog-1', program_name: 'Ausbildung Nursing', source_type: 'agency', source_agency_id: 'ag-6', source_agency_name: 'Nepal Overseas Services', assigned_recruiter_id: 'user-4', assigned_recruiter_name: 'David Chen', status: 'interview2', gate_status: 'eligible', total_score: 84.6, rank: 17, created_at: '2024-07-22T07:30:00Z', updated_at: '2024-12-08T09:00:00Z' },
  { candidate_id: 'cand-020', first_name: 'Tomasz', last_name: 'Wisniewski', dob: '1994-12-20', gender: 'male', country: 'Poland', email: 'tomasz.w@email.com', phone: '+48 503 456 789', highest_qualification: 'Bachelor of Engineering', program_id: 'prog-5', program_name: 'Construction Worker', source_type: 'direct', assigned_recruiter_id: 'user-3', assigned_recruiter_name: 'Lisa Anderson', status: 'placed', gate_status: 'eligible', total_score: 90.1, rank: 18, created_at: '2024-07-25T08:00:00Z', updated_at: '2024-11-30T10:00:00Z' },
  { candidate_id: 'cand-021', first_name: 'Leila', last_name: 'Hosseini', dob: '1998-08-08', gender: 'female', country: 'Iran', email: 'leila.h@email.com', phone: '+98 912 345 6789', highest_qualification: 'BSc Nursing', program_id: 'prog-2', program_name: 'Pflegefachkraft', source_type: 'agency', source_agency_id: 'ag-3', source_agency_name: 'Asia Recruitment Hub', assigned_recruiter_id: 'user-5', assigned_recruiter_name: 'Emma Wilson', status: 'waiting', gate_status: 'not_placement_ready', total_score: 52.3, rank: undefined, created_at: '2024-07-28T09:00:00Z', updated_at: '2024-12-01T11:00:00Z' },
  { candidate_id: 'cand-022', first_name: 'Carlos', last_name: 'Mendez', dob: '1997-06-16', gender: 'male', country: 'Mexico', email: 'carlos.m@email.com', phone: '+52 55 1234 5678', highest_qualification: 'Bachelor of Business Administration', program_id: 'prog-3', program_name: 'Hotel Management', source_type: 'direct', assigned_recruiter_id: 'user-4', assigned_recruiter_name: 'David Chen', status: 'interview1', gate_status: 'eligible', total_score: 73.9, rank: 19, created_at: '2024-08-01T10:00:00Z', updated_at: '2024-12-09T08:30:00Z' },
];

// ─── Candidate Documents ────────────────────────────────────
export const mockDocuments: CandidateDocument[] = [
  { id: 'doc-1', candidate_id: 'cand-001', document_type: 'passport', uploaded_by: 'user-3', file_path: 's3://docs/passport_001.pdf', encrypted: true, verified: true, verified_by: 'user-6', ocr_complete: true, ocr_confidence: 0.96, expiry_date: '2030-03-15', created_at: '2024-06-02T08:00:00Z' },
  { id: 'doc-2', candidate_id: 'cand-001', document_type: 'qualification', uploaded_by: 'user-3', file_path: 's3://docs/qual_001.pdf', encrypted: true, verified: true, verified_by: 'user-6', ocr_complete: true, ocr_confidence: 0.94, created_at: '2024-06-02T09:00:00Z' },
  { id: 'doc-3', candidate_id: 'cand-001', document_type: 'visa', uploaded_by: 'user-6', file_path: 's3://docs/visa_001.pdf', encrypted: true, verified: true, verified_by: 'user-6', ocr_complete: true, ocr_confidence: 0.98, created_at: '2024-09-01T10:00:00Z' },
  { id: 'doc-4', candidate_id: 'cand-002', document_type: 'passport', uploaded_by: 'user-3', file_path: 's3://docs/passport_002.pdf', encrypted: true, verified: true, verified_by: 'user-6', ocr_complete: true, ocr_confidence: 0.92, expiry_date: '2029-07-22', created_at: '2024-06-06T09:00:00Z' },
  { id: 'doc-5', candidate_id: 'cand-002', document_type: 'police_clearance', uploaded_by: 'user-3', file_path: 's3://docs/pc_002.pdf', encrypted: true, verified: false, ocr_complete: true, ocr_confidence: 0.78, created_at: '2024-06-06T10:00:00Z' },
  { id: 'doc-6', candidate_id: 'cand-003', document_type: 'passport', uploaded_by: 'user-4', file_path: 's3://docs/passport_003.pdf', encrypted: true, verified: true, verified_by: 'user-6', ocr_complete: true, ocr_confidence: 0.95, expiry_date: '2031-11-08', created_at: '2024-06-11T08:00:00Z' },
  { id: 'doc-7', candidate_id: 'cand-004', document_type: 'passport', uploaded_by: 'user-4', file_path: 's3://docs/passport_004.pdf', encrypted: true, verified: true, ocr_complete: true, ocr_confidence: 0.97, expiry_date: '2030-01-30', created_at: '2024-06-13T08:00:00Z' },
  { id: 'doc-8', candidate_id: 'cand-004', document_type: 'qualification', uploaded_by: 'user-4', file_path: 's3://docs/qual_004.pdf', encrypted: true, verified: true, ocr_complete: true, ocr_confidence: 0.93, created_at: '2024-06-13T09:00:00Z' },
  { id: 'doc-9', candidate_id: 'cand-005', document_type: 'passport', uploaded_by: 'user-3', file_path: 's3://docs/passport_005.pdf', encrypted: true, verified: false, ocr_complete: true, ocr_confidence: 0.85, expiry_date: '2029-05-20', created_at: '2024-06-16T09:00:00Z' },
  { id: 'doc-10', candidate_id: 'cand-006', document_type: 'passport', uploaded_by: 'user-5', file_path: 's3://docs/passport_006.pdf', encrypted: true, verified: true, verified_by: 'user-6', ocr_complete: true, ocr_confidence: 0.91, created_at: '2024-06-19T11:00:00Z' },
];

// ─── Contracts ──────────────────────────────────────────────
export const mockContracts: Contract[] = [
  { id: 'cont-1', candidate_id: 'cand-001', candidate_name: 'Priya Sharma', type: 'employment', status: 'signed', signed_at: '2024-11-15T10:00:00Z', created_at: '2024-11-01T08:00:00Z', updated_at: '2024-11-15T10:00:00Z' },
  { id: 'cont-2', candidate_id: 'cand-004', candidate_name: 'Chen Wei', type: 'offer_letter', status: 'sent', created_at: '2024-12-01T09:00:00Z', updated_at: '2024-12-01T09:00:00Z' },
  { id: 'cont-3', candidate_id: 'cand-015', candidate_name: 'Aisha Mohammed', type: 'training_agreement', status: 'sent', created_at: '2024-12-05T11:00:00Z', updated_at: '2024-12-05T11:00:00Z' },
  { id: 'cont-4', candidate_id: 'cand-010', candidate_name: 'James O\'Brien', type: 'employment', status: 'signed', signed_at: '2024-10-20T14:00:00Z', created_at: '2024-10-01T08:00:00Z', updated_at: '2024-10-20T14:00:00Z' },
  { id: 'cont-5', candidate_id: 'cand-020', candidate_name: 'Tomasz Wisniewski', type: 'employment', status: 'signed', signed_at: '2024-11-10T09:00:00Z', created_at: '2024-10-25T08:00:00Z', updated_at: '2024-11-10T09:00:00Z' },
  { id: 'cont-6', candidate_id: 'cand-003', candidate_name: 'Maria Gonzalez', type: 'offer_letter', status: 'signed', signed_at: '2024-08-15T10:00:00Z', created_at: '2024-08-01T09:00:00Z', updated_at: '2024-08-15T10:00:00Z' },
  { id: 'cont-7', candidate_id: 'cand-011', candidate_name: 'Linh Tran', type: 'employment', status: 'draft', created_at: '2024-12-08T10:00:00Z', updated_at: '2024-12-08T10:00:00Z' },
];

// ─── Visa Status ────────────────────────────────────────────
export const mockVisaStatuses: VisaStatus[] = [
  { id: 'visa-1', candidate_id: 'cand-001', candidate_name: 'Priya Sharma', status: 'approved', updated_by: 'user-6', notes: 'Work visa approved for 3 years', updated_at: '2024-10-20T10:00:00Z' },
  { id: 'visa-2', candidate_id: 'cand-003', candidate_name: 'Maria Gonzalez', status: 'approved', updated_by: 'user-6', notes: 'Student visa for Ausbildung', updated_at: '2024-09-15T11:00:00Z' },
  { id: 'visa-3', candidate_id: 'cand-004', candidate_name: 'Chen Wei', status: 'documents_submitted', updated_by: 'user-6', notes: 'Awaiting appointment', updated_at: '2024-12-05T16:00:00Z' },
  { id: 'visa-4', candidate_id: 'cand-013', candidate_name: 'Rosa Silva', status: 'appointment_booked', updated_by: 'user-6', notes: 'Appointment on Jan 15, 2025', updated_at: '2024-12-07T11:00:00Z' },
  { id: 'visa-5', candidate_id: 'cand-010', candidate_name: 'James O\'Brien', status: 'approved', updated_by: 'user-6', notes: 'EU citizen, no visa needed', updated_at: '2024-09-01T10:00:00Z' },
];

// ─── Notifications ──────────────────────────────────────────
export const mockNotifications: NotificationItem[] = [
  { id: 'notif-1', title: 'New Candidate Assigned', message: 'Ananya Patel has been assigned to you', type: 'candidate_update', read: false, entity_type: 'candidate', entity_id: 'cand-005', created_at: '2024-12-09T10:00:00Z' },
  { id: 'notif-2', title: 'Interview Scheduled', message: 'Interview 1 for Sunita Devi scheduled for Dec 15', type: 'interview_scheduled', read: false, entity_type: 'candidate', entity_id: 'cand-009', created_at: '2024-12-09T08:00:00Z' },
  { id: 'notif-3', title: 'Contract Signed', message: 'Priya Sharma has signed the employment contract', type: 'contract_ready', read: true, entity_type: 'contract', entity_id: 'cont-1', created_at: '2024-12-08T14:00:00Z' },
  { id: 'notif-4', title: 'Visa Approved', message: 'Maria Gonzalez visa application approved', type: 'visa_update', read: true, entity_type: 'visa', entity_id: 'visa-2', created_at: '2024-12-07T11:00:00Z' },
  { id: 'notif-5', title: 'Candidate Placed', message: 'Tomasz Wisniewski has been placed at Klinikum Stuttgart', type: 'placed', read: true, entity_type: 'candidate', entity_id: 'cand-020', created_at: '2024-12-06T10:00:00Z' },
  { id: 'notif-6', title: 'STI Assessment Due', message: 'Speaking assessment pending for Linh Tran', type: 'system', read: false, created_at: '2024-12-05T09:00:00Z' },
  { id: 'notif-7', title: 'Document Expiry Alert', message: 'Passport for Ahmed Hassan expires in 90 days', type: 'system', read: false, created_at: '2024-12-04T08:00:00Z' },
  { id: 'notif-8', title: 'Interview Feedback Required', message: 'Please submit feedback for Interview 2 - Bimala Gurung', type: 'system', read: true, created_at: '2024-12-03T14:00:00Z' },
];

// ─── Audit Events ───────────────────────────────────────────
export const mockAuditEvents: AuditEvent[] = [
  { id: 'audit-1', entity_type: 'candidate', entity_id: 'cand-001', event_type: 'status_change', actor_id: 'user-3', actor_name: 'Lisa Anderson', old_value: { status: 'contract' }, new_value: { status: 'placed' }, created_at: '2024-12-10T10:00:00Z' },
  { id: 'audit-2', entity_type: 'score', entity_id: 'cand-005', event_type: 'score_override', actor_id: 'user-1', actor_name: 'Admin User', old_value: { total_score: 74.2 }, new_value: { total_score: 76.4 }, created_at: '2024-12-09T15:00:00Z' },
  { id: 'audit-3', entity_type: 'document', entity_id: 'doc-1', event_type: 'document_verification', actor_id: 'user-6', actor_name: 'Sarah Johnson', old_value: { verified: false }, new_value: { verified: true }, created_at: '2024-12-08T11:00:00Z' },
  { id: 'audit-4', entity_type: 'contract', entity_id: 'cont-1', event_type: 'contract_signed', actor_id: 'cand-001', actor_name: 'Priya Sharma', created_at: '2024-11-15T10:00:00Z' },
  { id: 'audit-5', entity_type: 'candidate', entity_id: 'cand-002', event_type: 'status_change', actor_id: 'user-3', actor_name: 'Lisa Anderson', old_value: { status: 'interview1' }, new_value: { status: 'interview2' }, created_at: '2024-12-07T14:00:00Z' },
  { id: 'audit-6', entity_type: 'candidate', entity_id: 'cand-008', event_type: 'status_change', actor_id: 'user-4', actor_name: 'David Chen', old_value: { status: 'interview1' }, new_value: { status: 'rejected' }, created_at: '2024-11-28T15:00:00Z' },
];

// ─── STI Assessments ────────────────────────────────────────
export const mockSTISpeaking: STISpeaking[] = [
  { id: 'spk-1', candidate_id: 'cand-001', pronunciation: 85, fluency: 88, confidence: 90, vocabulary: 82, grammar: 86, overall_score: 86.2, trainer_notes: 'Excellent communication skills, very confident', trainer_name: 'Klaus Mueller', assessed_at: '2024-07-10T10:00:00Z' },
  { id: 'spk-2', candidate_id: 'cand-002', pronunciation: 78, fluency: 75, confidence: 80, vocabulary: 72, grammar: 76, overall_score: 76.2, trainer_notes: 'Good progress, needs vocabulary improvement', trainer_name: 'Klaus Mueller', assessed_at: '2024-08-05T11:00:00Z' },
  { id: 'spk-3', candidate_id: 'cand-003', pronunciation: 82, fluency: 85, confidence: 88, vocabulary: 80, grammar: 83, overall_score: 83.6, trainer_notes: 'Strong candidate, very confident speaker', trainer_name: 'Klaus Mueller', assessed_at: '2024-07-20T09:30:00Z' },
  { id: 'spk-4', candidate_id: 'cand-005', pronunciation: 70, fluency: 68, confidence: 72, vocabulary: 65, grammar: 70, overall_score: 69.0, trainer_notes: 'Average speaking skills, needs more practice', trainer_name: 'Klaus Mueller', assessed_at: '2024-08-15T10:00:00Z' },
  { id: 'spk-5', candidate_id: 'cand-009', pronunciation: 88, fluency: 90, confidence: 85, vocabulary: 86, grammar: 88, overall_score: 87.4, trainer_notes: 'Excellent German skills for the level', trainer_name: 'Klaus Mueller', assessed_at: '2024-09-01T08:00:00Z' },
];

export const mockSTITraining: STITraining[] = [
  { id: 'trn-1', candidate_id: 'cand-001', attendance: 95, assignments: 88, behaviour: 92, participation: 90, german_improvement: 85, recommendation: 'proceed', trainer_notes: 'Excellent trainee, highly recommended', trainer_name: 'Klaus Mueller', assessed_at: '2024-09-15T10:00:00Z' },
  { id: 'trn-2', candidate_id: 'cand-003', attendance: 92, assignments: 85, behaviour: 88, participation: 87, german_improvement: 82, recommendation: 'proceed', trainer_notes: 'Good progress overall', trainer_name: 'Klaus Mueller', assessed_at: '2024-08-25T09:00:00Z' },
  { id: 'trn-3', candidate_id: 'cand-005', attendance: 78, assignments: 72, behaviour: 80, participation: 75, german_improvement: 68, recommendation: 'caution', trainer_notes: 'Needs improvement in attendance and German', trainer_name: 'Klaus Mueller', assessed_at: '2024-09-20T11:00:00Z' },
];

export const mockSTIInterview1: STIInterview1[] = [
  { id: 'int1-1', candidate_id: 'cand-001', panel_members: ['Lisa Anderson', 'Klaus Mueller'], date: '2024-08-20T10:00:00Z', rating: 88, notes: 'Excellent candidate, strong motivation', decision: 'proceed', conductor_name: 'Lisa Anderson', created_at: '2024-08-20T10:00:00Z' },
  { id: 'int1-2', candidate_id: 'cand-002', panel_members: ['David Chen', 'Klaus Mueller'], date: '2024-09-10T11:00:00Z', rating: 80, notes: 'Good fit for hotel management role', decision: 'proceed', conductor_name: 'David Chen', created_at: '2024-09-10T11:00:00Z' },
  { id: 'int1-3', candidate_id: 'cand-003', panel_members: ['Lisa Anderson', 'Klaus Mueller'], date: '2024-08-15T09:00:00Z', rating: 85, notes: 'Strong nursing background, confident', decision: 'proceed', conductor_name: 'Lisa Anderson', created_at: '2024-08-15T09:00:00Z' },
  { id: 'int1-4', candidate_id: 'cand-005', panel_members: ['Emma Wilson', 'Klaus Mueller'], date: '2024-09-25T10:00:00Z', rating: 72, notes: 'Acceptable but some concerns about German level', decision: 'proceed', conductor_name: 'Emma Wilson', created_at: '2024-09-25T10:00:00Z' },
  { id: 'int1-5', candidate_id: 'cand-009', panel_members: ['David Chen', 'Klaus Mueller'], date: '2024-10-05T08:00:00Z', rating: 90, notes: 'Outstanding candidate', decision: 'proceed', conductor_name: 'David Chen', created_at: '2024-10-05T08:00:00Z' },
  { id: 'int1-6', candidate_id: 'cand-008', panel_members: ['Lisa Anderson'], date: '2024-09-01T10:00:00Z', rating: 45, notes: 'Poor German skills, not ready', decision: 'reject', conductor_name: 'Lisa Anderson', created_at: '2024-09-01T10:00:00Z' },
  { id: 'int1-7', candidate_id: 'cand-016', panel_members: ['Emma Wilson', 'Klaus Mueller'], date: '2024-12-05T10:00:00Z', rating: 86, notes: 'Very strong technical background', decision: 'proceed', conductor_name: 'Emma Wilson', created_at: '2024-12-05T10:00:00Z' },
  { id: 'int1-8', candidate_id: 'cand-022', panel_members: ['David Chen'], date: '2024-11-28T11:00:00Z', rating: 70, notes: 'Decent but needs more preparation', decision: 'hold', conductor_name: 'David Chen', created_at: '2024-11-28T11:00:00Z' },
];

export const mockSTIInterview2: STIInterview2[] = [
  { id: 'int2-1', candidate_id: 'cand-001', employer_id: 'emp-1', employer_name: 'Charite University Hospital', project_manager_name: 'Dr. Hans Mueller', date: '2024-09-15T10:00:00Z', rating: 92, notes: 'Excellent fit for the team', decision: 'selected', created_at: '2024-09-15T10:00:00Z' },
  { id: 'int2-2', candidate_id: 'cand-002', employer_id: 'emp-2', employer_name: 'Seniorenresidenz Rosenhof', project_manager_name: 'Ingrid Weber', date: '2024-10-20T11:00:00Z', rating: 82, notes: 'Good candidate for hospitality role', decision: 'selected', created_at: '2024-10-20T11:00:00Z' },
  { id: 'int2-3', candidate_id: 'cand-011', employer_id: 'emp-3', employer_name: 'Klinikum Stuttgart', project_manager_name: 'Dr. Klaus Meyer', date: '2024-11-15T09:00:00Z', rating: 88, notes: 'Strong nursing skills', decision: 'selected', created_at: '2024-11-15T09:00:00Z' },
  { id: 'int2-4', candidate_id: 'cand-019', employer_id: 'emp-4', employer_name: 'Ausbildungszentrum Hamburg', project_manager_name: 'Sabine Fischer', date: '2024-12-01T10:00:00Z', rating: 85, notes: 'Very motivated, good fit', decision: 'selected', created_at: '2024-12-01T10:00:00Z' },
];

// ─── Scoring Models ─────────────────────────────────────────
export const mockScoringModels: ScoringModel[] = [
  { id: 'sm-1', program_id: 'prog-2', criteria_name: '12th Grade Marks', weightage: 0.25, is_gating: false, minimum_threshold: undefined, max_score: 100 },
  { id: 'sm-2', program_id: 'prog-2', criteria_name: 'German B2 Certificate', weightage: 0.30, is_gating: true, minimum_threshold: 60, max_score: 100 },
  { id: 'sm-3', program_id: 'prog-2', criteria_name: 'Nursing Experience', weightage: 0.20, is_gating: false, minimum_threshold: undefined, max_score: 100 },
  { id: 'sm-4', program_id: 'prog-2', criteria_name: 'Interview Performance', weightage: 0.15, is_gating: false, minimum_threshold: undefined, max_score: 100 },
  { id: 'sm-5', program_id: 'prog-2', criteria_name: 'Age Factor', weightage: 0.10, is_gating: false, minimum_threshold: undefined, max_score: 100 },
  { id: 'sm-6', program_id: 'prog-1', criteria_name: '12th Grade Marks', weightage: 0.30, is_gating: false, minimum_threshold: undefined, max_score: 100 },
  { id: 'sm-7', program_id: 'prog-1', criteria_name: 'German A2 Certificate', weightage: 0.25, is_gating: true, minimum_threshold: 50, max_score: 100 },
  { id: 'sm-8', program_id: 'prog-1', criteria_name: 'Motivation Letter', weightage: 0.25, is_gating: false, minimum_threshold: undefined, max_score: 100 },
  { id: 'sm-9', program_id: 'prog-1', criteria_name: 'Interview Performance', weightage: 0.20, is_gating: false, minimum_threshold: undefined, max_score: 100 },
  { id: 'sm-10', program_id: 'prog-4', criteria_name: 'Technical Skills', weightage: 0.35, is_gating: true, minimum_threshold: 65, max_score: 100 },
  { id: 'sm-11', program_id: 'prog-4', criteria_name: 'German B1 Certificate', weightage: 0.25, is_gating: true, minimum_threshold: 55, max_score: 100 },
  { id: 'sm-12', program_id: 'prog-4', criteria_name: 'Work Experience', weightage: 0.25, is_gating: false, minimum_threshold: undefined, max_score: 100 },
  { id: 'sm-13', program_id: 'prog-4', criteria_name: 'Problem Solving', weightage: 0.15, is_gating: false, minimum_threshold: undefined, max_score: 100 },
];

// ─── Candidate Scores ───────────────────────────────────────
export const mockCandidateScores: CandidateScore[] = [
  { id: 'cs-1', candidate_id: 'cand-001', scoring_model_id: 'sm-2', criteria_name: 'German B2 Certificate', raw_score: 88, normalized_score: 90, weighted_score: 27, gate_status: 'eligible' },
  { id: 'cs-2', candidate_id: 'cand-001', scoring_model_id: 'sm-1', criteria_name: '12th Grade Marks', raw_score: 85, normalized_score: 87, weighted_score: 21.75, gate_status: 'eligible' },
  { id: 'cs-3', candidate_id: 'cand-001', scoring_model_id: 'sm-3', criteria_name: 'Nursing Experience', raw_score: 90, normalized_score: 92, weighted_score: 18.4, gate_status: 'eligible' },
  { id: 'cs-4', candidate_id: 'cand-001', scoring_model_id: 'sm-4', criteria_name: 'Interview Performance', raw_score: 92, normalized_score: 93, weighted_score: 13.95, gate_status: 'eligible' },
  { id: 'cs-5', candidate_id: 'cand-001', scoring_model_id: 'sm-5', criteria_name: 'Age Factor', raw_score: 80, normalized_score: 82, weighted_score: 8.2, gate_status: 'eligible' },
  { id: 'cs-6', candidate_id: 'cand-008', scoring_model_id: 'sm-2', criteria_name: 'German B2 Certificate', raw_score: 35, normalized_score: 32, weighted_score: 9.6, gate_status: 'not_placement_ready' },
  { id: 'cs-7', candidate_id: 'cand-008', scoring_model_id: 'sm-1', criteria_name: '12th Grade Marks', raw_score: 60, normalized_score: 58, weighted_score: 14.5, gate_status: 'not_placement_ready' },
  { id: 'cs-8', candidate_id: 'cand-008', scoring_model_id: 'sm-3', criteria_name: 'Nursing Experience', raw_score: 45, normalized_score: 43, weighted_score: 8.6, gate_status: 'not_placement_ready' },
];

// ─── Users ──────────────────────────────────────────────────
export const mockUsers: User[] = [
  { id: 'user-1', name: 'Deeban', email: 'deeban@workforce-europe.com', role: 'super_admin', department: 'Management', status: 'active', mfa_enabled: true, created_at: '2024-01-01T08:00:00Z' },
  { id: 'user-2', name: 'Margaret Thompson', email: 'margaret@workforce-europe.com', role: 'managing_director', department: 'Management', status: 'active', mfa_enabled: true, created_at: '2024-01-01T09:00:00Z' },
  { id: 'user-3', name: 'Lisa Anderson', email: 'lisa@workforce-europe.com', role: 'recruiter', department: 'Recruitment', status: 'active', mfa_enabled: true, created_at: '2024-01-15T08:00:00Z' },
  { id: 'user-4', name: 'David Chen', email: 'david@workforce-europe.com', role: 'recruiter', department: 'Recruitment', status: 'active', mfa_enabled: true, created_at: '2024-01-20T09:00:00Z' },
  { id: 'user-5', name: 'Emma Wilson', email: 'emma@workforce-europe.com', role: 'recruiter', department: 'Recruitment', status: 'active', mfa_enabled: true, created_at: '2024-02-01T10:00:00Z' },
  { id: 'user-6', name: 'Sarah Johnson', email: 'sarah@workforce-europe.com', role: 'documentation_officer', department: 'Documentation', status: 'active', mfa_enabled: true, created_at: '2024-02-15T08:00:00Z' },
  { id: 'user-7', name: 'Klaus Mueller', email: 'klaus@workforce-europe.com', role: 'german_trainer', department: 'Training', status: 'active', mfa_enabled: false, created_at: '2024-03-01T09:00:00Z' },
  { id: 'user-8', name: 'Rajesh Kumar', email: 'rajesh@gts.com', role: 'agency_partner', department: 'External', status: 'active', mfa_enabled: true, created_at: '2024-03-15T10:00:00Z' },
  { id: 'user-9', name: 'Dr. Hans Mueller', email: 'hans@charite.de', role: 'employer', department: 'External', status: 'active', mfa_enabled: false, created_at: '2024-04-01T08:00:00Z' },
  { id: 'user-10', name: 'Ingrid Weber', email: 'ingrid@rosenhof.de', role: 'employer', department: 'External', status: 'active', mfa_enabled: false, created_at: '2024-04-15T09:00:00Z' },
  { id: 'user-11', name: 'James Smith', email: 'james@workforce-europe.com', role: 'sales_executive', department: 'Sales', status: 'active', mfa_enabled: false, created_at: '2024-05-01T08:00:00Z' },
];

// ─── Email Logs ─────────────────────────────────────────────
export const mockEmailLogs: EmailLog[] = [
  { id: 'eml-1', candidate_id: 'cand-001', candidate_name: 'Priya Sharma', template: 'placement_confirmation', subject: 'Congratulations! Placement Confirmation', sent_by: 'Lisa Anderson', sent_at: '2024-12-10T10:00:00Z', status: 'sent' },
  { id: 'eml-2', candidate_id: 'cand-004', candidate_name: 'Chen Wei', template: 'offer_letter', subject: 'Offer Letter - IT Specialist Position', sent_by: 'David Chen', sent_at: '2024-12-01T09:00:00Z', status: 'sent' },
  { id: 'eml-3', candidate_id: 'cand-008', candidate_name: 'Nguyen Van Thanh', template: 'rejection', subject: 'Update on Your Application', sent_by: 'Lisa Anderson', sent_at: '2024-11-28T15:00:00Z', status: 'sent' },
  { id: 'eml-4', candidate_id: 'cand-009', candidate_name: 'Sunita Devi', template: 'interview_invite', subject: 'Interview Invitation - Interview 1', sent_by: 'David Chen', sent_at: '2024-12-08T08:00:00Z', status: 'sent' },
  { id: 'eml-5', candidate_id: 'cand-015', candidate_name: 'Aisha Mohammed', template: 'contract_ready', subject: 'Your Training Agreement is Ready', sent_by: 'Emma Wilson', sent_at: '2024-12-05T11:00:00Z', status: 'sent' },
];

// ─── Extraction Fields ──────────────────────────────────────
export const mockExtractionFields: ExtractionField[] = [
  { field_name: 'first_name', ai_suggested_value: 'Priya', human_confirmed_value: 'Priya', confidence: 0.98, status: 'confirmed' },
  { field_name: 'last_name', ai_suggested_value: 'Sharma', human_confirmed_value: 'Sharma', confidence: 0.97, status: 'confirmed' },
  { field_name: 'date_of_birth', ai_suggested_value: '1998-03-15', human_confirmed_value: '1998-03-15', confidence: 0.95, status: 'confirmed' },
  { field_name: 'passport_number', ai_suggested_value: 'J8362847', human_confirmed_value: undefined, confidence: 0.82, status: 'pending' },
  { field_name: 'nationality', ai_suggested_value: 'Indian', human_confirmed_value: 'Indian', confidence: 0.99, status: 'confirmed' },
  { field_name: 'issue_date', ai_suggested_value: '2020-03-15', human_confirmed_value: undefined, confidence: 0.76, status: 'pending' },
  { field_name: 'expiry_date', ai_suggested_value: '2030-03-15', human_confirmed_value: undefined, confidence: 0.88, status: 'pending' },
];

// ─── Activity Items ─────────────────────────────────────────
export const mockActivityItems: ActivityItem[] = [
  { id: 'act-1', type: 'placement', description: 'Priya Sharma placed at Charite University Hospital', actor: 'Lisa Anderson', timestamp: '2024-12-10T10:00:00Z', entityType: 'candidate', entityId: 'cand-001' },
  { id: 'act-2', type: 'status_change', description: 'Ahmed Hassan moved to Interview 2', actor: 'David Chen', timestamp: '2024-12-09T14:00:00Z', entityType: 'candidate', entityId: 'cand-002' },
  { id: 'act-3', type: 'contract', description: 'Training agreement sent to Aisha Mohammed', actor: 'Emma Wilson', timestamp: '2024-12-08T11:00:00Z', entityType: 'contract', entityId: 'cont-3' },
  { id: 'act-4', type: 'interview', description: 'Interview 1 completed for Piotr Nowak - Rating: 86', actor: 'Emma Wilson', timestamp: '2024-12-07T10:00:00Z', entityType: 'candidate', entityId: 'cand-016' },
  { id: 'act-5', type: 'document', description: 'Passport verified for Priya Sharma', actor: 'Sarah Johnson', timestamp: '2024-12-06T11:00:00Z', entityType: 'document', entityId: 'doc-1' },
  { id: 'act-6', type: 'visa', description: 'Visa approved for Maria Gonzalez', actor: 'Sarah Johnson', timestamp: '2024-12-05T11:00:00Z', entityType: 'visa', entityId: 'visa-2' },
  { id: 'act-7', type: 'sti', description: 'Speaking assessment completed for Linh Tran', actor: 'Klaus Mueller', timestamp: '2024-12-04T10:00:00Z', entityType: 'candidate', entityId: 'cand-011' },
  { id: 'act-8', type: 'score', description: 'Score recalculated for Ananya Patel', actor: 'System', timestamp: '2024-12-03T09:00:00Z', entityType: 'candidate', entityId: 'cand-005' },
  { id: 'act-9', type: 'rejection', description: 'Nguyen Van Thanh rejected after Interview 1', actor: 'Lisa Anderson', timestamp: '2024-11-28T15:00:00Z', entityType: 'candidate', entityId: 'cand-008' },
  { id: 'act-10', type: 'placement', description: 'Tomasz Wisniewski placed at Klinikum Stuttgart', actor: 'Lisa Anderson', timestamp: '2024-11-25T10:00:00Z', entityType: 'candidate', entityId: 'cand-020' },
];
