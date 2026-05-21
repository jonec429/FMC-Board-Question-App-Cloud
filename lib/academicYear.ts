/**
 * Academic-year helpers for the FMC QBank year-over-year (YoY) model.
 *
 * The residency academic year runs July 1 -> June 30. We identify an academic
 * year by its ENDING calendar year (AY 2025-26 -> 2026), matching the program's
 * "Class of YYYY" graduation-year convention. A family-medicine resident's PGY
 * is derived from their cohort_year so it advances automatically each July 1 —
 * no manual bumping of every resident's record.
 */

export type Track = 'family_medicine' | 'ob_fellow' | 'academic_fellow' | 'faculty';

export interface RosterRow {
  name?: string;
  email?: string;
  pgy?: string; // legacy "Class of YYYY" / "Faculty" string
  advisor?: string;
  cohort_year?: number | null;
  track?: Track | null;
  pgy_override?: number | null;
  status?: string | null; // 'active' | 'graduated' | 'on_leave'
  graduated_year?: number | null;
}

/** Academic year identified by its ending calendar year (July rollover). */
export function getCurrentAcademicYear(now: Date = new Date()): number {
  const month = now.getMonth(); // 0 = Jan ... 6 = Jul
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year; // July onward belongs to the next ending-year
}

/** Formats an academic year integer into 'AY 25-26' format. */
export function formatAcademicYear(year: number): string {
  const start = (year - 1).toString().slice(-2);
  const end = year.toString().slice(-2);
  return `AY ${start}-${end}`;
}

/** Returns a list of recent academic years for filtering (current + 3 previous). */
export function getAvailableAcademicYears(): number[] {
  const current = getCurrentAcademicYear();
  return [current, current - 1, current - 2, current - 3];
}

/** Derived PGY for a family-medicine resident (1-based). */
export function derivePGY(cohortYear: number, academicYear: number = getCurrentAcademicYear()): number {
  return academicYear - cohortYear;
}

/** Human-readable label for the roster row's class/role column. */
export function deriveLabel(row: RosterRow, academicYear: number = getCurrentAcademicYear()): string {
  if (row.status === 'graduated') {
    return row.graduated_year ? `Graduated ${row.graduated_year}` : 'Graduated';
  }
  if (row.status === 'on_leave') return 'On Leave';
  if (row.pgy_override) return `PGY${row.pgy_override}`;

  switch (row.track) {
    case 'faculty':
      return 'Faculty';
    case 'ob_fellow':
      return 'OB Fellow';
    case 'academic_fellow':
      return 'Academic Fellow';
    case 'family_medicine': {
      if (row.cohort_year == null) return row.pgy || 'Resident';
      const pgy = derivePGY(row.cohort_year, academicYear);
      if (pgy < 1) return 'Incoming';
      if (pgy > 3) return 'Graduated';
      return `PGY${pgy}`;
    }
    default:
      return row.pgy || 'Resident'; // legacy fallback for rows not yet migrated
  }
}

/** True if this row is an active FM resident — the cohort that takes ITE blocks. */
export function isActiveResident(row: RosterRow): boolean {
  if ((row.status ?? 'active') !== 'active') return false;
  if (row.track) return row.track === 'family_medicine';
  // Legacy fallback for rows not yet migrated to the track model: anything not
  // explicitly marked Faculty is treated as a resident.
  return row.pgy !== 'Faculty';
}

/** True if the row should be hidden from default dashboards (graduated). */
export function isGraduated(row: RosterRow): boolean {
  return row.status === 'graduated';
}

/**
 * Convert the Add/Edit modal's class/role selection into stored fields.
 * Keeps the legacy `pgy` string in sync for backward compatibility.
 */
export function mapSelectionToFields(
  selection: string,
  academicYear: number = getCurrentAcademicYear()
): { cohort_year: number | null; track: Track; pgy: string } {
  if (selection === 'Faculty') return { cohort_year: null, track: 'faculty', pgy: 'Faculty' };
  if (selection === 'OB Fellow') return { cohort_year: academicYear, track: 'ob_fellow', pgy: 'OB Fellow' };
  if (selection === 'Academic Fellow') return { cohort_year: academicYear, track: 'academic_fellow', pgy: 'Academic Fellow' };
  const m = selection.match(/Class of (\d{4})/);
  if (m) {
    const gradYear = parseInt(m[1], 10);
    return { cohort_year: gradYear - 3, track: 'family_medicine', pgy: selection };
  }
  return { cohort_year: null, track: 'family_medicine', pgy: selection };
}

/**
 * The class/role options for the Add/Edit dropdown. "Class of YYYY" entries are
 * generated relative to the current academic year so the labels never go stale
 * (PGY3 = graduating this AY, down to next year's incoming class).
 */
export function getRoleOptions(academicYear: number = getCurrentAcademicYear()): { value: string; label: string }[] {
  return [
    { value: `Class of ${academicYear}`, label: `Class of ${academicYear} (PGY3)` },
    { value: `Class of ${academicYear + 1}`, label: `Class of ${academicYear + 1} (PGY2)` },
    { value: `Class of ${academicYear + 2}`, label: `Class of ${academicYear + 2} (PGY1)` },
    { value: `Class of ${academicYear + 3}`, label: `Class of ${academicYear + 3} (Incoming)` },
    { value: 'OB Fellow', label: 'OB Fellow' },
    { value: 'Academic Fellow', label: 'Academic Fellow' },
    { value: 'Faculty', label: 'Faculty / Admin' },
  ];
}
