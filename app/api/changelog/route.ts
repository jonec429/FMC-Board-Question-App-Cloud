import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const roadmapPath = path.join(process.cwd(), 'ROADMAP.md');
    const content = await fs.readFile(roadmapPath, 'utf8');

    // Parse the "## 🆕 Recent Updates (Changelog)" section
    const sectionStart = content.indexOf('## 🆕 Recent Updates (Changelog)');
    if (sectionStart === -1) {
      return NextResponse.json({ updates: [] });
    }

    const sectionContent = content.substring(sectionStart);
    const lines = sectionContent.split('\n');
    
    // Look for lines starting with "- " after the header
    const updates = lines
      .filter(line => line.trim().startsWith('- '))
      .map(line => line.trim().substring(2));

    return NextResponse.json({ updates });
  } catch (error) {
    console.error('Error reading changelog:', error);
    return NextResponse.json({ updates: ['Error loading updates.'] }, { status: 500 });
  }
}
