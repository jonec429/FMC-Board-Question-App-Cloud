// This file will contain the logic to sync data with Google Sheets
// It will be used in Next.js API routes (Server-side only)

export async function syncToGoogleSheet(sheetName: string, data: any) {
  console.log(`Syncing to ${sheetName}...`, data);
  // Implementation will use googleapis or google-spreadsheet package
}
