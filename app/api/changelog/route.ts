import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const roadmapPath = path.join(process.cwd(), 'ROADMAP.md');
    const content = await fs.readFile(roadmapPath, 'utf8');

    // Parse the changelog section dynamically, avoiding hardcoded emojis
    // We look for the "Recent Updates (Changelog)" header (ignoring any emoji prefix)
    const lines = content.split('\n');
    let inChangelog = false;
    const structuredUpdates: { date: string, title: string, items: string[] }[] = [];
    
    let currentRelease: { date: string, title: string, items: string[] } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.match(/^##\s+.*?Recent Updates \(Changelog\)/i)) {
        inChangelog = true;
        continue;
      }
      
      if (inChangelog) {
        // Stop if we hit the next major section
        if (line.match(/^##\s+/)) {
          break;
        }
        
        // H3 header (e.g., "### 2026-08-18 — Title (Author)")
        const h3Match = line.match(/^###\s+(.*?)\s*[—-]\s*(.*)/);
        if (h3Match) {
          if (currentRelease && currentRelease.items.length > 0) {
            structuredUpdates.push(currentRelease);
          }
          currentRelease = {
            date: h3Match[1].trim(),
            title: h3Match[2].trim(),
            items: []
          };
          continue;
        }
        
        // If it's a fallback H3 without a dash
        const h3FallbackMatch = line.match(/^###\s+(.*)/);
        if (!h3Match && h3FallbackMatch) {
           if (currentRelease && currentRelease.items.length > 0) {
            structuredUpdates.push(currentRelease);
          }
          currentRelease = {
            date: h3FallbackMatch[1].trim(),
            title: '',
            items: []
          };
          continue;
        }

        // Bullets
        if (currentRelease && /^[-*]\s+/.test(line)) {
          currentRelease.items.push(line.replace(/^[-*]\s+/, ''));
        }
      }
    }
    
    if (currentRelease && currentRelease.items.length > 0) {
      structuredUpdates.push(currentRelease);
    }

    return NextResponse.json({ releases: structuredUpdates });
  } catch (error) {
    console.error('Error reading changelog:', error);
    return NextResponse.json({ releases: [] }, { status: 500 });
  }
}
