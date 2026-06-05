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

    // Bound to the changelog section: from its header to the next top-level (## )
    // heading, so we don't scoop bullets from unrelated sections below it.
    const afterHeader = content.substring(sectionStart);
    const nextSection = afterHeader.indexOf('\n## ', 1);
    const sectionContent = nextSection === -1 ? afterHeader : afterHeader.substring(0, nextSection);

    // Capture bullet lines (both "-" and "*" styles, any indentation) and strip the marker.
    const updates = sectionContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^[-*]\s+/.test(line))
      .map(line => line.replace(/^[-*]\s+/, ''));

    return NextResponse.json({ updates });
  } catch (error) {
    console.error('Error reading changelog:', error);
    return NextResponse.json({ updates: ['Error loading updates.'] }, { status: 500 });
  }
}
