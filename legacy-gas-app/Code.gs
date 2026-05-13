/**
 * FMC BOARD QUESTION APP BACKEND
 * Hardcoded Spreadsheet ID: 1U8wqv1TmeDBDvmWBMXNnMerHipZMJrowa3vzD-NOFww
 */

var SHEET_ID = "1U8wqv1TmeDBDvmWBMXNnMerHipZMJrowa3vzD-NOFww";
var SCHEDULE_SHEET_ID = "1w_HDpmO-95xPABGz_Exs26eGaJWt3DxCZH0pyrTWBG8"; // LIVE SCHEDULE ID

// --- PROGRAM CONSTANTS ---
var AT_RISK_AVG_THRESHOLD    = 60;    // Below 60% average = at risk (red)
var AT_RISK_ONTIME_THRESHOLD = 0.50;  // Below 50% on-time blocks = at risk (red)
var CONCERN_AVG_THRESHOLD    = 70;    // Below 70% average = needs attention (yellow)
var CONCERN_ONTIME_THRESHOLD = 0.75;  // Below 75% on-time blocks = needs attention (yellow)
var ATTENDANCE_POINTS_VALUE  = 1;     // Points per attendance entry

function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('FMC Board Question App')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setupSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Fixed Quizzes Master List
  var masterSheet = ss.getSheetByName("Quiz_Master_List");
  if (!masterSheet) {
    masterSheet = ss.insertSheet("Quiz_Master_List");
    masterSheet.appendRow(["Quiz ID", "Title", "Description", "Tab Name", "Last Updated"]);
    masterSheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#e0e0e0");
    masterSheet.setFrozenRows(1); 
  }
  
  // Results Sheet
  var resultsSheet = ss.getSheetByName("Results");
  if (!resultsSheet) {
    resultsSheet = ss.insertSheet("Results");
    resultsSheet.appendRow(["Timestamp", "Resident", "Email", "Topic", "Correct", "Total", "Percentage", "Category Stats", "Academic Points"]);
    resultsSheet.getRange(1, 1, 1, 9).setFontWeight("bold");
    resultsSheet.setFrozenRows(1); 
  }

  // Master Question Bank
  var bankSheet = ss.getSheetByName("QUESTION_BANK");
  if (!bankSheet) {
    bankSheet = ss.insertSheet("QUESTION_BANK");
    bankSheet.appendRow(["Year", "Category", "Question", "Correct Index", "Explanation", "Resource Link", "Opt A", "Opt B", "Opt C", "Opt D", "Opt E"]);
    bankSheet.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#d9ead3").setWrap(true);
    bankSheet.setFrozenRows(1);
    bankSheet.setColumnWidth(3, 400); // Question column
    bankSheet.setColumnWidth(5, 300); // Explanation column
  }

  // Administrative Tracking Sheets
  var rosterSheet = ss.getSheetByName("Roster");
  if (!rosterSheet) {
    rosterSheet = ss.insertSheet("Roster");
    rosterSheet.appendRow(["Resident Name", "Email", "Class Of (PGY)", "Faculty Advisor"]);
    rosterSheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#cfe2f3");
    rosterSheet.setFrozenRows(1);
  }

  var scheduleSheet = ss.getSheetByName("Block_Schedule");
  if (!scheduleSheet) {
    scheduleSheet = ss.insertSheet("Block_Schedule");
    scheduleSheet.appendRow(["Block Title", "Start Date", "End Date"]);
    scheduleSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#fff2cc");
    scheduleSheet.setFrozenRows(1);
    // NOTE: Populate this sheet manually in Google Sheets with your block titles and date ranges.
    // Add one row per assigned quiz topic (e.g. "Block 1", "Hematologic/Immune") with its Start and End dates.
    // This sheet is read dynamically at runtime - update it each academic year as needed.
  }

  // Local mirror of the Live Schedule
  var dailyScheduleSheet = ss.getSheetByName("Daily_Schedule");
  if (!dailyScheduleSheet) {
    dailyScheduleSheet = ss.insertSheet("Daily_Schedule");
    dailyScheduleSheet.appendRow(["Date", "Topic"]);
    dailyScheduleSheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#d9d2e9");
    dailyScheduleSheet.setFrozenRows(1);
  }

  var attendanceSheet = ss.getSheetByName("Attendance");
  if (!attendanceSheet) {
    attendanceSheet = ss.insertSheet("Attendance");
    attendanceSheet.appendRow(["Timestamp", "Resident", "Email", "Conference Date", "Topic", "Status", "Academic Points"]);
    attendanceSheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#d9ead3");
    attendanceSheet.setFrozenRows(1);
  } else {
    var headers = attendanceSheet.getRange(1, 1, 1, attendanceSheet.getLastColumn()).getValues()[0];
    var statusIdx = headers.indexOf("Status");
    if (statusIdx === -1) {
      // Insert Status before Academic Points if possible, else at end
      var ptsIdx = headers.indexOf("Academic Points");
      if (ptsIdx !== -1) {
        attendanceSheet.insertColumnBefore(ptsIdx + 1);
        attendanceSheet.getRange(1, ptsIdx + 1).setValue("Status").setFontWeight("bold");
      } else {
        attendanceSheet.getRange(1, attendanceSheet.getLastColumn() + 1).setValue("Status").setFontWeight("bold");
      }
    }
  }
  
  return "Database ready and updated with master schedule dates.";
}

function getSheetUrl() { return "https://docs.google.com/spreadsheets/d/" + SHEET_ID; }

// --- FIXED QUIZ DATABASE FUNCTIONS ---

function getQuizMetadata() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    
    // 1. Get Quizzes
    var masterSheet = ss.getSheetByName("Quiz_Master_List");
    var quizzes = [];
    if (masterSheet && masterSheet.getLastRow() >= 2) {
      var masterData = masterSheet.getDataRange().getValues();
      for (var i = 1; i < masterData.length; i++) {
        var row = masterData[i];
        var tab = ss.getSheetByName(row[3]);
        var qCount = tab ? Math.max(0, tab.getLastRow() - 1) : 0;
        quizzes.push({ id: row[0], title: row[1], description: row[2], questionCount: qCount });
      }
    }
    
    // 2. Get Roster
    var rosterSheet = ss.getSheetByName("Roster");
    var roster = [];
    if (rosterSheet && rosterSheet.getLastRow() >= 2) {
      var rosterData = rosterSheet.getDataRange().getValues();
      for(var i=1; i<rosterData.length; i++) {
          if (rosterData[i][0]) roster.push({ name: rosterData[i][0], email: rosterData[i][1], pgy: rosterData[i][2], advisor: rosterData[i][3] });
      }
    }
    
    // 3. Get Sheet URL
    var sheetUrl = "https://docs.google.com/spreadsheets/d/" + SHEET_ID;
    
    return { quizzes: quizzes, roster: roster, sheetUrl: sheetUrl };
  } catch (e) { return { quizzes: [], roster: [], sheetUrl: "" }; }
}

function getQuizContent(quizId) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var masterSheet = ss.getSheetByName("Quiz_Master_List");
    var data = masterSheet.getDataRange().getValues();
    var targetRow = data.find(row => row[0] == quizId);
    if (!targetRow) return null;
    var tab = ss.getSheetByName(targetRow[3]);
    if (!tab) return null;
    var qData = tab.getDataRange().getValues();
    var questions = [];
    for (var j = 1; j < qData.length; j++) {
      var qRow = qData[j];
      var isNewLayout = !isNaN(Number(qRow[3])) && String(qRow[3]).trim() !== "";
      var system = isNewLayout ? qRow[1] : qRow[0];
      var question = isNewLayout ? qRow[2] : qRow[1];
      var correct = isNewLayout ? Number(qRow[3]) : Number(qRow[2]);
      var explanation = isNewLayout ? qRow[4] : qRow[3];
      var resource = isNewLayout ? qRow[5] : qRow[4];
      var optStart = isNewLayout ? 6 : 5;
      var options = [qRow[optStart], qRow[optStart+1], qRow[optStart+2], qRow[optStart+3], qRow[optStart+4]].filter(o => o);
      var year = isNewLayout ? qRow[0] : "";
      var difficulty = isNewLayout ? qRow[11] : "";
      var abfmCategory = isNewLayout ? qRow[12] : "";
      
      questions.push({ 
        category: system, // Maintained for backwards compatibility with UI filters
        system: system,
        abfmCategory: abfmCategory,
        question: question, 
        correct: correct, 
        explanation: explanation, 
        resource: resource, 
        options: options,
        year: year,
        difficulty: difficulty
      });
    }
    return { id: targetRow[0], title: targetRow[1], description: targetRow[2], questions: questions };
  } catch (e) { return null; }
}

function generateRandomMixedBlock(count) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var masterSheet = ss.getSheetByName("Quiz_Master_List");
    if (!masterSheet) return null;
    var masterData = masterSheet.getDataRange().getValues();
    var allQuestions = [];
    for (var i = 1; i < masterData.length; i++) {
      var tab = ss.getSheetByName(masterData[i][3]);
      if (tab) {
        var qData = tab.getDataRange().getValues();
        for (var j = 1; j < qData.length; j++) {
          var qRow = qData[j];
          var isNewLayout = !isNaN(Number(qRow[3])) && String(qRow[3]).trim() !== "";
          var questionText = isNewLayout ? qRow[2] : qRow[1];
          if (!questionText) continue;
          
          var system = isNewLayout ? qRow[1] : qRow[0];
          var correct = isNewLayout ? Number(qRow[3]) : Number(qRow[2]);
          var explanation = isNewLayout ? qRow[4] : qRow[3];
          var resource = isNewLayout ? qRow[5] : qRow[4];
          var optStart = isNewLayout ? 6 : 5;
          var options = [qRow[optStart], qRow[optStart+1], qRow[optStart+2], qRow[optStart+3], qRow[optStart+4]].filter(o => o);
          var year = isNewLayout ? qRow[0] : "";
          var difficulty = isNewLayout ? qRow[11] : "";
          var abfmCategory = isNewLayout ? qRow[12] : "";

          allQuestions.push({ 
            category: system || "Mixed", 
            system: system,
            abfmCategory: abfmCategory,
            question: questionText, 
            correct: correct, 
            explanation: explanation, 
            resource: resource, 
            options: options,
            year: year,
            difficulty: difficulty
          });
        }
      }
    }
    if (allQuestions.length === 0) return null;
    for (var i = allQuestions.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }
    return { 
      id: 'random-' + new Date().getTime(), 
      title: 'Mixed Review Block', 
      description: 'Randomly generated block from all fixed questions.', 
      questions: allQuestions.slice(0, count || 40) 
    };
  } catch(e) { return null; }
}

function getQuizzesFromSheet() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var masterSheet = ss.getSheetByName("Quiz_Master_List");
    if (!masterSheet || masterSheet.getLastRow() < 2) return [];
    var masterData = masterSheet.getDataRange().getValues();
    var quizzes = [];
    for (var i = 1; i < masterData.length; i++) {
      var row = masterData[i];
      var tab = ss.getSheetByName(row[3]);
      if (tab) {
        var qData = tab.getDataRange().getValues();
        var questions = [];
        for (var j = 1; j < qData.length; j++) {
          var qRow = qData[j];
          var isNewLayout = !isNaN(Number(qRow[3])) && String(qRow[3]).trim() !== "";
          var system = isNewLayout ? qRow[1] : qRow[0];
          var questionText = isNewLayout ? qRow[2] : qRow[1];
          var correct = isNewLayout ? Number(qRow[3]) : Number(qRow[2]);
          var explanation = isNewLayout ? qRow[4] : qRow[3];
          var resource = isNewLayout ? qRow[5] : qRow[4];
          var optStart = isNewLayout ? 6 : 5;
          var options = [qRow[optStart], qRow[optStart+1], qRow[optStart+2], qRow[optStart+3], qRow[optStart+4]].filter(o => o);
          var year = isNewLayout ? qRow[0] : "";
          var difficulty = isNewLayout ? qRow[11] : "";
          var abfmCategory = isNewLayout ? qRow[12] : "";

          questions.push({ 
            category: system, 
            system: system,
            abfmCategory: abfmCategory,
            question: questionText, 
            correct: correct, 
            explanation: explanation, 
            resource: resource, 
            options: options,
            year: year,
            difficulty: difficulty
          });
        }
        quizzes.push({ id: row[0], title: row[1], description: row[2], questions: questions });
      }
    }
    return quizzes;
  } catch (e) { return []; }
}

function saveFullQuizList(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var quizList = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!quizList || !Array.isArray(quizList)) return "No data";
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var masterSheet = ss.getSheetByName("Quiz_Master_List");
    if (!masterSheet) { masterSheet = ss.insertSheet("Quiz_Master_List"); masterSheet.setFrozenRows(1); }
    
    var lastRow = masterSheet.getLastRow();
    var existingMap = {};
    if (lastRow > 1) {
      var oldData = masterSheet.getRange(2, 1, lastRow - 1, 5).getValues();
      oldData.forEach(function(row) {
        if (row[0]) existingMap[String(row[0])] = String(row[3]);
      });
      masterSheet.getRange(2, 1, lastRow - 1, 5).clearContent();
    }
    
    var masterRows = [];
    var activeTabs = [];
    quizList.forEach(function(quiz) {
      var safeTitle = quiz.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);
      var quizIdStr = String(quiz.id);
      var tabName = "QZ_" + safeTitle + "_" + quizIdStr.substring(Math.max(0, quizIdStr.length - 4));
      activeTabs.push(tabName);
      masterRows.push([quiz.id, quiz.title, quiz.description || "", tabName, new Date()]);
      
      Utilities.sleep(100); 
      
      var oldTabName = existingMap[quizIdStr];
      var sheet = null;
      
      if (oldTabName && oldTabName !== tabName) {
        sheet = ss.getSheetByName(oldTabName);
        if (sheet) {
          try { sheet.setName(tabName); } catch(e) {}
        }
      }
      
      if (!sheet) sheet = ss.getSheetByName(tabName);
      if (!sheet) { sheet = ss.insertSheet(tabName); sheet.setFrozenRows(1); }
      
      if (quiz.questions && Array.isArray(quiz.questions)) {
        sheet.clear();
        var headers = ["Category", "Question", "Correct Index", "Explanation", "Resource Link", "Opt A", "Opt B", "Opt C", "Opt D", "Opt E"];
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d9ead3").setWrap(true);

        if (quiz.questions.length > 0) {
          var qRows = quiz.questions.map(function(q) {
            var opts = q.options || [];
            return [q.category || "General", q.question, q.correct, q.explanation, q.resource || "", opts[0]||"", opts[1]||"", opts[2]||"", opts[3]||"", opts[4]||""];
          });
          sheet.getRange(2, 1, qRows.length, 10).setValues(qRows);
          sheet.setColumnWidth(2, 400);
          sheet.setColumnWidth(4, 300);
          sheet.getDataRange().setWrap(true).setVerticalAlignment("top");
        }
      }
    });

    if (masterRows.length > 0) masterSheet.getRange(2, 1, masterRows.length, 5).setValues(masterRows);
    var allSheets = ss.getSheets();
    allSheets.forEach(function(sheet) {
      var sName = sheet.getName();
      if (sName.startsWith("QZ_") && !activeTabs.includes(sName)) {
        try { ss.deleteSheet(sheet); } catch(e) {}
      }
    });
    SpreadsheetApp.flush();
    return "Success";
  } catch(e) { return "Error: " + e.toString(); } finally { lock.releaseLock(); }
}

function deleteQuizFromSheet(id) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var master = ss.getSheetByName("Quiz_Master_List");
    var data = master.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        var tab = ss.getSheetByName(data[i][3]);
        if (tab) ss.deleteSheet(tab);
        master.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return "Deleted";
      }
    }
  } catch(e) {} finally { lock.releaseLock(); }
}

// --- MASTER QUESTION BANK FUNCTIONS ---

function appendToQuestionBank(payloadString, yearStr, categoryOverride) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var questions = JSON.parse(payloadString);
    if (!Array.isArray(questions) || questions.length === 0) return "No questions to save.";
    
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var bankSheet = ss.getSheetByName("QUESTION_BANK");
    if (!bankSheet) setupSheet(); 
    bankSheet = ss.getSheetByName("QUESTION_BANK");
    
    var year = yearStr || new Date().getFullYear().toString();
    
    var rowsToAppend = questions.map(function(q) {
      var cat = categoryOverride ? categoryOverride : (q.category || "General");
      var opts = q.options || [];
      return [
        year, 
        cat, 
        q.question, 
        q.correct, 
        q.explanation || "", 
        q.resource || "", 
        opts[0]||"", opts[1]||"", opts[2]||"", opts[3]||"", opts[4]||""
      ];
    });
    
    bankSheet.getRange(bankSheet.getLastRow() + 1, 1, rowsToAppend.length, 11).setValues(rowsToAppend);
    SpreadsheetApp.flush();
    return "Successfully added " + rowsToAppend.length + " questions to Master Bank.";
  } catch(e) { 
    return "Error: " + e.toString(); 
  } finally { lock.releaseLock(); }
}

function getBankFilters() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var bankSheet = ss.getSheetByName("QUESTION_BANK");
    if (!bankSheet || bankSheet.getLastRow() < 2) return { years: [], categories: [], total: 0 };
    
    var data = bankSheet.getRange(2, 1, bankSheet.getLastRow() - 1, 3).getValues(); 
    var years = {};
    var categories = {};
    var count = 0;
    
    for (var i = 0; i < data.length; i++) {
      if (!data[i][2]) count++; 
      var y = String(data[i][0]).trim();
      var c = String(data[i][1]).trim();
      if (y) years[y] = true;
      if (c) categories[c] = true;
    }
    
    return {
      years: Object.keys(years).sort().reverse(), 
      categories: Object.keys(categories).sort(),
      total: data.length
    };
  } catch (e) {
    return { years: [], categories: [], total: 0 };
  }
}

function generateCustomQuiz(configStr) {
  try {
    var config = JSON.parse(configStr);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var bankSheet = ss.getSheetByName("QUESTION_BANK");
    if (!bankSheet || bankSheet.getLastRow() < 2) return null;
    
    var data = bankSheet.getDataRange().getValues();
    var pool = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[2]) continue; 
      var y = String(row[0]).trim();
      var c = String(row[1]).trim();
      
      var yearMatch = config.years.length === 0 || config.years.includes(y);
      var catMatch = config.categories.length === 0 || config.categories.includes(c);
      
      if (yearMatch && catMatch) {
        var options = [row[6], row[7], row[8], row[9], row[10]].filter(o => o);
        pool.push({
          year: y,
          category: c,
          question: row[2],
          correct: Number(row[3]),
          explanation: row[4],
          resource: row[5],
          options: options
        });
      }
    }
    
    if (pool.length === 0) return { error: "No questions match those filters." };
    
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    var finalCount = Math.min(pool.length, config.count || 40);
    
    return {
      id: 'custom-' + new Date().getTime(),
      title: 'Custom Quiz Bank Block',
      description: 'Custom block generated from Master Bank.',
      questions: pool.slice(0, finalCount),
      totalPoolFound: pool.length
    };
    
  } catch (e) {
    return { error: e.toString() };
  }
}

function adminSearchBank(keyword, filtersStr) {
  try {
    var filters = JSON.parse(filtersStr || "{}");
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var bankSheet = ss.getSheetByName("QUESTION_BANK");
    if (!bankSheet || bankSheet.getLastRow() < 2) return { error: "No bank found." };
    
    var data = bankSheet.getDataRange().getValues();
    var results = [];
    var keyLimit = keyword ? String(keyword).toLowerCase().trim() : "";
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[2]) continue; 
      
      var y = String(row[0]).trim();
      var c = String(row[1]).trim();
      var q = String(row[2]).trim();
      var exp = String(row[4] || "").trim();
      
      var yearMatch = !filters.years || filters.years.length === 0 || filters.years.includes(y);
      var catMatch = !filters.categories || filters.categories.length === 0 || filters.categories.includes(c);
      var keyMatch = !keyLimit || q.toLowerCase().includes(keyLimit) || exp.toLowerCase().includes(keyLimit) || c.toLowerCase().includes(keyLimit);
      
      if (yearMatch && catMatch && keyMatch) {
        var options = [row[6], row[7], row[8], row[9], row[10]].filter(function(o) { return !!o; });
        results.push({
          year: y,
          category: c,
          question: q,
          correct: Number(row[3]),
          explanation: exp,
          resource: row[5],
          options: options
        });
      }
    }
    
    return { results: results };
  } catch (e) {
    return { error: e.toString() };
  }
}

// --- STATS, SAVING, AND ATTENDANCE ---

function getResidentHistory(email) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Results");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    
    // Dynamic mapping to prevent column misalignments
    var headers = data[0] || [];
    var colMap = {};
    for (var h = 0; h < headers.length; h++) {
       if (headers[h]) colMap[String(headers[h]).trim().toLowerCase()] = h;
    }
    var emailIdx = colMap["email"] !== undefined ? colMap["email"] : 2;
    var topicIdx = colMap["topic"] !== undefined ? colMap["topic"] : 3;
    
    var completed = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][emailIdx]).toLowerCase().trim() === String(email).toLowerCase().trim()) {
        completed.push(data[i][topicIdx]);
      }
    }
    return completed;
  } catch(e) { return []; }
}

function saveToSheet(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var email = String(data.email || "").toLowerCase().trim();
    if (!email.endsWith("@ascension.org")) return "Error: Invalid Domain";
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Results");
    
    if (!sheet) {
        sheet = ss.insertSheet("Results");
        sheet.appendRow(["Timestamp", "Resident", "Email", "Topic", "Correct", "Total", "Percentage", "Category Stats", "Academic Points"]); 
        sheet.setFrozenRows(1); 
    }

    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = [];
    if (sheet.getLastRow() > 0) {
      headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    } else {
      headers = ["Timestamp", "Resident", "Email", "Topic", "Correct", "Total", "Percentage", "Category Stats", "Academic Points"];
      sheet.appendRow(headers);
    }

    // CREATE DYNAMIC INDEX MAP to ensure perfect alignment even if columns are moved or renamed
    var colMap = {};
    for (var i = 0; i < headers.length; i++) {
        if (!headers[i]) continue;
        var h = String(headers[i]).trim().toLowerCase();
        colMap[h] = i;
        if (h === "resident" || h === "name") colMap["resident_col"] = i;
        if (h === "topic" || h === "conference topic" || h === "subject") colMap["topic_col"] = i;
        if (h === "conference date" || h === "date") colMap["date_col"] = i;
        if (h === "academic points" || h === "points") colMap["points_col"] = i;
        if (h === "email") colMap["email_col"] = i;
        if (h === "timestamp") colMap["timestamp_col"] = i;
    }

    // --- STRICT HEADER VALIDATION ---
    var requiredColumns = ["timestamp", "topic", "correct", "total", "category stats", "academic points", "email"];
    var missingColumns = [];
    for (var i = 0; i < requiredColumns.length; i++) {
        if (colMap[requiredColumns[i]] === undefined) {
            missingColumns.push(requiredColumns[i]);
        }
    }
    // Check aliases for Name and Percentage
    if (colMap["resident"] === undefined && colMap["name"] === undefined) missingColumns.push("resident (or name)");
    if (colMap["percentage"] === undefined && colMap["score"] === undefined) missingColumns.push("percentage (or score)");

    if (missingColumns.length > 0) {
        return "Error: The Results sheet is missing required columns: " + missingColumns.join(", ") + ". Please restore exact headers.";
    }

    var points = 0; 
    var topicLower = String(data.topic).toLowerCase().trim();
    var isBonus = topicLower.includes("bonus");
    var isAssignedBlock = topicLower.match(/block\s*\d+/) || topicLower.includes("breakout");
    
    if (isBonus) {
        points = 2;
    } else {
        var blockSheet = ss.getSheetByName("Block_Schedule");
        
        if (blockSheet && blockSheet.getLastRow() > 1) {
            var blockData = blockSheet.getDataRange().getValues();
            var now = new Date();
            var matchedBlock = false;
            
            for (var i = 1; i < blockData.length; i++) {
                var bTitle = String(blockData[i][0]).toLowerCase().trim();
                if(!bTitle) continue;
                
                // Robust matching: Extract block number prefix (e.g. "block 10" or "block breakout")
                var qNum = topicLower.match(/^block\s*(\d+|breakout)/i)?.[0]?.trim();
                var bNum = bTitle.match(/^block\s*(\d+|breakout)/i)?.[0]?.trim();
                
                var isMatch = false;
                if (qNum && bNum) {
                    isMatch = (qNum === bNum);
                } else {
                    // Fallback to fuzzy match if no number found
                    isMatch = topicLower.includes(bTitle) || bTitle.includes(topicLower);
                }

                if (isMatch) {
                    matchedBlock = true;
                    var bEnd = new Date(blockData[i][2]);
                    bEnd.setHours(23, 59, 59, 999); 

                    if (now <= bEnd) {
                        points = 2; // On time
                    } else {
                        points = 1; // Late
                    }
                    break;
                }
            }
            
            if (!matchedBlock && isAssignedBlock) {
                points = ""; // STRICT COMPLIANCE: Leave blank instead of guessing 1 point or failing
            }
        } else if (isAssignedBlock) {
            points = ""; // If blockSheet is completely missing or empty, gracefully leave blank
        }
    }

    var date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm");
    var categoryStatsString = data.categoryStats ? JSON.stringify(data.categoryStats) : "{}";
    var percentage = data.total > 0 ? ((data.score/data.total)*100).toFixed(1) + "%" : "0%";

    // Resolve tricky column aliases (Correct vs Score)
    var rawScoreIdx = colMap["correct"];
    var pctIdx = colMap["percentage"] !== undefined ? colMap["percentage"] : colMap["score"];

    // Build Payload Dynamically against specific headers
    var payloadRow = new Array(headers.length).fill("");
    payloadRow[colMap["timestamp"]] = date;
    payloadRow[colMap["resident"] !== undefined ? colMap["resident"] : colMap["name"]] = data.resident;
    payloadRow[colMap["email"]] = email;
    payloadRow[colMap["topic"]] = data.topic;
    payloadRow[rawScoreIdx] = data.score;
    payloadRow[colMap["total"]] = data.total;
    payloadRow[pctIdx] = percentage;
    payloadRow[colMap["category stats"]] = categoryStatsString;
    payloadRow[colMap["academic points"]] = points;

    sheet.appendRow(payloadRow);
    
    // --- NEW: LOG INDIVIDUAL QUESTION ANALYTICS ---
    if (data.answers && Array.isArray(data.answers) && data.answers.length > 0) {
        var analyticsSheet = ss.getSheetByName("Question_Analytics");
        if (!analyticsSheet) {
            analyticsSheet = ss.insertSheet("Question_Analytics");
            analyticsSheet.appendRow(["Timestamp", "Email", "QuizID", "Resource", "Category", "Difficulty", "Correct"]);
            analyticsSheet.setFrozenRows(1);
        }
        var timestampRaw = new Date();
        var analyticsRows = data.answers.map(function(ans) {
            return [
                timestampRaw,
                email,
                data.topic, // use topic/quizID
                String(ans.resource || ""),
                String(ans.category || ""),
                String(ans.difficulty || ""),
                ans.correct ? "TRUE" : "FALSE"
            ];
        });
        
        if (analyticsRows.length > 0) {
            var lastRowA = Math.max(analyticsSheet.getLastRow(), 1);
            analyticsSheet.getRange(lastRowA + 1, 1, analyticsRows.length, 7).setValues(analyticsRows);
        }
    }
    
    SpreadsheetApp.flush();
    sendQuizReport(data);
    return "Saved";
  } catch(e) { return "Error: " + e.toString(); } finally { lock.releaseLock(); }
}

// --- NEW: FETCH QUESTION COMMUNITY STATS ---
function getQuestionStats(quizId) {
    try {
        var ss = SpreadsheetApp.openById(SHEET_ID);
        var sheet = ss.getSheetByName("Question_Analytics");
        if (!sheet || sheet.getLastRow() < 2) return {};
        
        var data = sheet.getDataRange().getValues();
        var stats = {}; // map of resource -> { correct: X, total: Y }
        
        for (var i = 1; i < data.length; i++) {
            var rowQuizId = String(data[i][2]);
            var resource = String(data[i][3]);
            if (!resource) continue; // Skip if no resource identifier
            
            // Allow fetching all if quizId isn't passed, or filter by quizId
            if (!quizId || rowQuizId === quizId) {
                if (!stats[resource]) stats[resource] = { correct: 0, total: 0 };
                stats[resource].total++;
                if (String(data[i][6]).toUpperCase() === "TRUE") {
                    stats[resource].correct++;
                }
            }
        }
        
        return stats;
    } catch (e) {
        return {};
    }
}

function sendQuizReport(data) {
  try {
    var subject = "Quiz Results: " + data.topic;
    var htmlBody = "<div style='font-family: Arial, sans-serif; color: #333;'><h2 style='color: #2563eb;'>Block Completion Report</h2>";
    htmlBody += "<p><strong>Topic:</strong> " + data.topic + "</p><p><strong>Resident:</strong> " + data.resident + "</p>";
    htmlBody += "<p><strong>Score:</strong> " + data.score + " / " + data.total + " (" + ((data.score/data.total)*100).toFixed(1) + "%)</p><hr>";
    if (data.missed && data.missed.length > 0) {
      htmlBody += "<h3 style='color: #d93025;'>Incorrect Topics for Review</h3><ul>";
      data.missed.forEach(function(m) {
        htmlBody += "<li style='margin-bottom: 15px;'><strong>" + (m.category || "General") + ":</strong> " + m.question + "<br><span style='color: green;'>\u2705 Correct: " + m.correctAnswer + "</span></li>";
      });
      htmlBody += "</ul>";
    } else { htmlBody += "<p style='color: green; font-weight: bold;'>Perfect score!</p>"; }
    htmlBody += "</div>";
    MailApp.sendEmail({ to: data.email, subject: subject, htmlBody: htmlBody });
  } catch (e) { Logger.log("Email error: " + e.toString()); }
}

// --- MEGA FUNCTION: ALL STATS FETCHED AT ONCE ---
function getAdminStats() {
  // --- BLOCKS TO EXCLUDE FROM ALL STATS (add demo/test blocks here) ---
  var EXCLUDED_BLOCKS = ["Demo Quiz", "Demo Quiz 2"];
  var EXCLUDED_EMAILS = ["jonathan.carbungco@ascension.org"];
  var excludedLower = EXCLUDED_BLOCKS.map(function(b) { return b.toLowerCase().trim(); });
  var excludedEmailsLower = EXCLUDED_EMAILS.map(function(e) { return e.toLowerCase().trim(); });

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    
    // 1. Initialize StatsMap natively from Roster
    var rosterSheet = ss.getSheetByName("Roster");
    var rosterData = rosterSheet ? rosterSheet.getDataRange().getValues() : [];
    var statsMap = {};
    
    for (var i = 1; i < rosterData.length; i++) {
      var email = String(rosterData[i][1]).toLowerCase().trim();
      if (email && excludedEmailsLower.indexOf(email) === -1) {
        statsMap[email] = {
          name: rosterData[i][0],
          email: email,
          pgy: String(rosterData[i][2]),
          isFaculty: String(rosterData[i][2]).toLowerCase().trim() === 'faculty',
          advisor: rosterData[i][3] || "Unassigned",
          advisorEmail: String(rosterData[i][4] || "").trim(),
          attempts: 0,
          totalCorrect: 0,
          totalPossible: 0,
          lastDate: "",
          totalQuestionsCompleted: 0,
          assignedBlocksCompleted: 0,
          customBlocksCompleted: 0,
          totalAttendancePoints: 0,
          brqPoints: 0,
          academicPoints: 0,
          history: [],
          topics: {},
          attendanceHistory: []
        };
      }
    }
    
    // Build name-to-email map for resolving missing emails (Results/Attendance)
    var nameToEmail = {};
    for (var i = 1; i < rosterData.length; i++) {
      var rName = String(rosterData[i][0]).trim().toLowerCase();
      var rEmail = String(rosterData[i][1]).trim().toLowerCase();
      if (rName && rEmail) nameToEmail[rName] = rEmail;
    }
    
    // Support name overrides (Report Name -> Roster Name)
    try {
      var overrides = getNameOverrides();
      for (var rNameKey in overrides) {
        var canonicalName = overrides[rNameKey];
        var canonicalEmail = nameToEmail[canonicalName.toLowerCase()];
        if (canonicalEmail) {
          nameToEmail[rNameKey.toLowerCase()] = canonicalEmail;
        }
      }
    } catch(e) { Logger.log("Override load error: " + e.message); }
    
    // 2. Parse Test Results (DYNAMICALLY MAPPED)
    var resultsSheet = ss.getSheetByName("Results");
    if (resultsSheet && resultsSheet.getLastRow() >= 2) {
      var resultsData = resultsSheet.getDataRange().getValues();
      var headers = resultsData[0];
      var hMap = {};
      for(var h = 0; h < headers.length; h++) {
         if(headers[h]) hMap[String(headers[h]).trim().toLowerCase()] = h;
      }
      
      var emailIdx = hMap["email"] !== undefined ? hMap["email"] : 2;
      var nameIdx = hMap["resident"] !== undefined ? hMap["resident"] : (hMap["name"] !== undefined ? hMap["name"] : 1);
      var topicIdx = hMap["topic"] !== undefined ? hMap["topic"] : 3;
      var scoreIdx = hMap["correct"] !== undefined ? hMap["correct"] : (hMap["score"] !== undefined && hMap["percentage"] !== undefined ? hMap["score"] : 4);
      var totalIdx = hMap["total"] !== undefined ? hMap["total"] : 5;
      var catIdx = hMap["category stats"] !== undefined ? hMap["category stats"] : 7;
      var ptsIdx = hMap["academic points"] !== undefined ? hMap["academic points"] : 8;
      var timeIdx = hMap["timestamp"] !== undefined ? hMap["timestamp"] : 0;

      for (var i = 1; i < resultsData.length; i++) {
        var row = resultsData[i];
        var rEmail = String(row[emailIdx] || "").toLowerCase().trim();
        if (!rEmail || excludedEmailsLower.indexOf(rEmail) !== -1) continue;
        
        if (!statsMap[rEmail]) {
          statsMap[rEmail] = {
            name: row[nameIdx] || "Unknown",
            email: rEmail,
            pgy: "Unknown",
            isFaculty: false,
            advisor: "Unassigned",
            advisorEmail: "",
            attempts: 0,
            totalCorrect: 0,
            totalPossible: 0,
            lastDate: "",
            totalQuestionsCompleted: 0,
            assignedBlocksCompleted: 0,
            customBlocksCompleted: 0,
            totalAttendancePoints: 0,
            brqPoints: 0,
            history: [],
            topics: {},
            attendanceHistory: []
          };
        }
        
        var score = Number(row[scoreIdx]) || 0;
        var total = Number(row[totalIdx]) || 0;
        var topic = String(row[topicIdx] || "");
        var percentage = total > 0 ? Math.round((score / total) * 100) : 0;
        var pts = Number(row[ptsIdx]) || 0;
        
        // Skip excluded blocks (demo/test quizzes) - nondestructive, data is never modified
        if (excludedLower.indexOf(topic.toLowerCase().trim()) > -1) continue;
        
        statsMap[rEmail].attempts++;
        statsMap[rEmail].totalCorrect += score;
        statsMap[rEmail].totalPossible += total;
        statsMap[rEmail].totalQuestionsCompleted += total;
        statsMap[rEmail].lastDate = row[timeIdx]; 
        
        // --- POINT DEDUPLICATION ---
        // Only award points once per unique topic per resident
        if (!statsMap[rEmail].completedTopicsMap) statsMap[rEmail].completedTopicsMap = {};
        var cleanTopic = topic.toLowerCase().trim();
        
        if (!statsMap[rEmail].completedTopicsMap[cleanTopic]) {
          statsMap[rEmail].brqPoints += pts;
          statsMap[rEmail].completedTopicsMap[cleanTopic] = true;
          
          if (cleanTopic.match(/block\s*\d+/)) {
            statsMap[rEmail].assignedBlocksCompleted++;
          } else {
            statsMap[rEmail].customBlocksCompleted++;
          }
        }
        
        var dateStr = row[timeIdx] instanceof Date ? Utilities.formatDate(row[timeIdx], Session.getScriptTimeZone(), "MM/dd/yyyy") : String(row[timeIdx] || "");
        statsMap[rEmail].history.push({ date: dateStr, topic: topic, score: score, total: total, percentage: percentage, points: pts });
        
        var granularStats = {};
        try { if (row[catIdx]) granularStats = JSON.parse(row[catIdx]); } catch(e) {}
        var hasGranular = Object.keys(granularStats).length > 0;
        
        if (hasGranular) {
          for (var cat in granularStats) {
            var rawCat = cat.split('(')[0].trim();
            var baseCat = rawCat; // Keep original casing for display if new
            var catKey = rawCat.toLowerCase();
            
            if (!statsMap[rEmail].topics[catKey]) {
              statsMap[rEmail].topics[catKey] = { display: rawCat, correct: 0, total: 0 };
            }
            statsMap[rEmail].topics[catKey].correct += granularStats[cat].correct;
            statsMap[rEmail].topics[catKey].total += granularStats[cat].total;
          }
        } else {
          var rawTopic = topic.split('(')[0].trim();
          var topicKey = rawTopic.toLowerCase();
          if (!statsMap[rEmail].topics[topicKey]) {
            statsMap[rEmail].topics[topicKey] = { display: rawTopic, correct: 0, total: 0 };
          }
          statsMap[rEmail].topics[topicKey].correct += score;
          statsMap[rEmail].topics[topicKey].total += total;
        }
      }
    }
    
    // 3. Parse Attendance (DYNAMICALLY MAPPED)
    var attSheet = ss.getSheetByName("Attendance");
    if (attSheet && attSheet.getLastRow() >= 2) {
      var attData = attSheet.getDataRange().getValues();
      var aHeaders = attData[0];
      var aMap = {};
      for(var h = 0; h < aHeaders.length; h++) {
         if(aHeaders[h]) aMap[String(aHeaders[h]).trim().toLowerCase()] = h;
      }
      var aEmailIdx = aMap["email"] !== undefined ? aMap["email"] : 2;
      var aDateIdx = aMap["conference date"] !== undefined ? aMap["conference date"] : 3;
      var aTopicIdx = aMap["topic"] !== undefined ? aMap["topic"] : 4;
      var aPtsIdx = aMap["academic points"] !== undefined ? aMap["academic points"] : 5;

      for (var i = 1; i < attData.length; i++) {
        var aEmail = String(attData[i][aEmailIdx] || "").toLowerCase().trim();
        var aName = (aMap["resident"] !== undefined || aMap["name"] !== undefined) ? String(attData[i][aMap["resident"] || aMap["name"]] || "").trim().toLowerCase() : "";
        
        // Resolve missing email via name
        if (!aEmail && aName && nameToEmail[aName]) {
          aEmail = nameToEmail[aName];
        }
        
        if (aEmail && statsMap[aEmail]) {
          var pts = Number(attData[i][aPtsIdx]) || 0;
          var rawStatus = aMap["status"] !== undefined ? String(attData[i][aMap["status"]] || "").trim() : "";
          var status = rawStatus || (pts > 0 ? "Attended" : "Absent");
          statsMap[aEmail].totalAttendancePoints += pts;
          var dateRaw = attData[i][aDateIdx];
          var dateStr = dateRaw instanceof Date ? Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), "MM/dd/yyyy") : String(dateRaw || "");
          statsMap[aEmail].attendanceHistory.push({ date: dateStr, topic: String(attData[i][aTopicIdx] || ""), points: pts, status: status });
        }
      }
    }
    
    // 4. Format Output for both Frontend and PDF Generator
    var result = Object.keys(statsMap).map(function(key) {
      var s = statsMap[key];
      var avg = s.totalPossible > 0 ? Math.round((s.totalCorrect / s.totalPossible) * 100) : 0;
      
      var topicAverages = Object.keys(s.topics).map(function(k) {
        var tData = s.topics[k];
        return {
          topic: tData.display,
          total: tData.total,
          average: tData.total > 0 ? Math.round((tData.correct / tData.total) * 100) : 0,
          percentage: tData.total > 0 ? Math.round((tData.correct / tData.total) * 100) : 0
        };
      });
      
      return {
        name: s.name,
        email: s.email,
        pgy: s.pgy,
        advisor: s.advisor,
        advisorEmail: s.advisorEmail,
        attempts: s.attempts,
        average: avg,
        percentage: avg,
        totalQuestionsCompleted: s.totalQuestionsCompleted,
        assignedBlocksCompleted: s.assignedBlocksCompleted,
        customBlocksCompleted: s.customBlocksCompleted,
        totalAttendancePoints: s.totalAttendancePoints,
        brqPoints: s.brqPoints,
        academicPoints: s.totalAttendancePoints + s.brqPoints,
        lastDate: s.lastDate instanceof Date ? Utilities.formatDate(s.lastDate, Session.getScriptTimeZone(), "MM/dd/yyyy") : String(s.lastDate || ""),
        history: s.history, 
        attendanceHistory: s.attendanceHistory, 
        topicAverages: topicAverages.sort(function(a, b) { 
          if (b.total !== a.total) return b.total - a.total;
          return b.average - a.average; 
        }) 
      };
    });
    
    result.sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });
    return result;
  } catch (e) {
    Logger.log("Stats Error: " + e.toString());
    return [];
  }
}

function getRoster() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Roster");
    if (!sheet || sheet.getLastRow() < 2) return [];
    var data = sheet.getDataRange().getValues();
    var roster = [];
    for(var i=1; i<data.length; i++) {
        if (data[i][0]) roster.push({ 
            name: String(data[i][0]), 
            email: String(data[i][1]), 
            pgy: String(data[i][2] || ""), 
            advisor: String(data[i][3] || ""),
            advisorEmail: String(data[i][4] || "") 
        });
    }
    return roster;
  } catch(e) { return []; }
}

function saveRoster(rosterData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Roster");
    if (!sheet) {
      sheet = ss.insertSheet("Roster");
      sheet.appendRow(["Resident Name", "Email", "Class Of (PGY)", "Faculty Advisor", "Advisor Email"]);
      sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#cfe2f3");
      sheet.setFrozenRows(1);
    }
    
    var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 5)).getValues()[0];
    if (headers.length < 5 || !headers[4]) {
      sheet.getRange(1, 4).setValue("Faculty Advisor");
      sheet.getRange(1, 5).setValue("Advisor Email");
      sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#cfe2f3");
    }

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
    
    var rows = [];

    rosterData.forEach(function(r) {
      if (r.name && r.email) {
        rows.push([r.name, r.email, r.pgy || "", r.advisor || "", r.advisorEmail || ""]);
      }
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    }
    SpreadsheetApp.flush();
    return "Success";
  } catch(e) {
    return "Error saving roster: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

function logAttendance(email, residentName, dateStr, topic, status) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Attendance");
    if (!sheet) {
        sheet = ss.insertSheet("Attendance");
        sheet.appendRow(["Timestamp", "Resident", "Email", "Conference Date", "Topic", "Academic Points"]);
        sheet.setFrozenRows(1);
    }
    
    var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    var colMap = {};
    for (var i = 0; i < headers.length; i++) {
        if (!headers[i]) continue;
        var h = String(headers[i]).trim().toLowerCase();
        colMap[h] = i;
        if (h === "resident" || h === "name") colMap["resident_col"] = i;
        if (h === "topic" || h === "conference topic" || h === "subject") colMap["topic_col"] = i;
        if (h === "conference date" || h === "date") colMap["date_col"] = i;
        if (h === "academic points" || h === "points") colMap["points_col"] = i;
        if (h === "email") colMap["email_col"] = i;
        if (h === "timestamp") colMap["timestamp_col"] = i;
    }

    // --- FLEXIBLE HEADER VALIDATION ---
    var missingHeaders = [];
    if (colMap["timestamp_col"] === undefined) missingHeaders.push("Timestamp");
    if (colMap["email_col"] === undefined) missingHeaders.push("Email");
    if (colMap["date_col"] === undefined) missingHeaders.push("Conference Date");
    if (colMap["topic_col"] === undefined) missingHeaders.push("Topic");
    if (colMap["points_col"] === undefined) missingHeaders.push("Academic Points");
    if (colMap["resident_col"] === undefined) missingHeaders.push("Resident Name");

    if (missingHeaders.length > 0) {
        return "Error: The Attendance sheet is missing required columns: " + missingHeaders.join(", ") + ". Please ensure these headers exist.";
    }
    
    // --- DEDUPLICATION CHECK ---
    var existingData = sheet.getLastRow() > 1 ? sheet.getDataRange().getValues() : [];
    var targetEmail = String(email).toLowerCase().trim();
    var targetTopic = String(topic || "Manual Entry").toLowerCase().trim();
    var targetDate = String(dateStr).trim();
    
    for (var i = 1; i < existingData.length; i++) {
        var row = existingData[i];
        var rEmail = String(row[colMap["email_col"]] || "").toLowerCase().trim();
        var rTopic = String(row[colMap["topic_col"]] || "").toLowerCase().trim();
        var rDateRaw = row[colMap["date_col"]];
        var rDate = rDateRaw instanceof Date ? Utilities.formatDate(rDateRaw, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(rDateRaw).trim();
        
        // Basic match: if email, topic, and date string match, skip.
        if (rEmail === targetEmail && rTopic === targetTopic && rDate === targetDate) {
            return "Notice: Attendance already logged for this date and topic.";
        }
    }
    
    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm");
    
    var payloadRow = new Array(headers.length).fill("");
    if (colMap["timestamp_col"] !== undefined) payloadRow[colMap["timestamp_col"]] = ts;
    if (colMap["resident_col"] !== undefined) payloadRow[colMap["resident_col"]] = residentName;
    if (colMap["email_col"] !== undefined) payloadRow[colMap["email_col"]] = email;
    if (colMap["date_col"] !== undefined) payloadRow[colMap["date_col"]] = dateStr;
    if (colMap["topic_col"] !== undefined) payloadRow[colMap["topic_col"]] = topic || "Manual Entry";
    if (colMap["status"] !== undefined) payloadRow[colMap["status"]] = status || "Attended";
    if (colMap["points_col"] !== undefined) payloadRow[colMap["points_col"]] = 1;

    sheet.appendRow(payloadRow); 
    SpreadsheetApp.flush();
    return "Success";
  } catch(e) { return "Error: " + e.toString(); } finally { lock.releaseLock(); }
}

function saveBulkAttendance(dateStr, topicStr, attendees) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Attendance");
    if (!sheet) {
        sheet = ss.insertSheet("Attendance");
        sheet.appendRow(["Timestamp", "Resident", "Email", "Conference Date", "Topic", "Academic Points"]);
        sheet.setFrozenRows(1);
    }
    
    var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    var colMap = {};
    for (var i = 0; i < headers.length; i++) {
        if (!headers[i]) continue;
        var h = String(headers[i]).trim().toLowerCase();
        colMap[h] = i;
        if (h === "resident" || h === "name") colMap["resident_col"] = i;
        if (h === "topic" || h === "conference topic" || h === "subject") colMap["topic_col"] = i;
        if (h === "conference date" || h === "date") colMap["date_col"] = i;
        if (h === "academic points" || h === "points") colMap["points_col"] = i;
        if (h === "email") colMap["email_col"] = i;
        if (h === "timestamp") colMap["timestamp_col"] = i;
    }

    // --- STRICT HEADER VALIDATION ---
    var requiredColumns = ["timestamp", "email", "conference date", "topic", "academic points"];
    var missingColumns = [];
    for (var i = 0; i < requiredColumns.length; i++) {
        if (colMap[requiredColumns[i]] === undefined) missingColumns.push(requiredColumns[i]);
    }
    if (colMap["resident"] === undefined && colMap["name"] === undefined) missingColumns.push("resident (or name)");

    if (missingColumns.length > 0) {
        return "Error: The Attendance sheet is missing required columns: " + missingColumns.join(", ") + ". Please restore exact headers.";
    }
    
    // --- DEDUPLICATION CHECK ---
    var existingData = sheet.getLastRow() > 1 ? sheet.getDataRange().getValues() : [];
    var targetTopic = String(topicStr || "Manual Entry").toLowerCase().trim();
    var targetDate = String(dateStr).trim();
    
    var newAttendees = attendees.filter(function(att) {
        var attEmail = String(att.email).toLowerCase().trim();
        for (var i = 1; i < existingData.length; i++) {
            var row = existingData[i];
            var rEmail = String(row[colMap["email_col"]] || "").toLowerCase().trim();
            var rTopic = String(row[colMap["topic_col"]] || "").toLowerCase().trim();
            var rDateRaw = row[colMap["date_col"]];
            var rDate = rDateRaw instanceof Date ? Utilities.formatDate(rDateRaw, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(rDateRaw).trim();
            
            if (rEmail === attEmail && rTopic === targetTopic && rDate === targetDate) {
                return false; // Skip duplicate
            }
        }
        return true; // Keep
    });
    
    if (newAttendees.length === 0) {
        return "Notice: All selected residents already have attendance logged for this topic and date.";
    }

    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm");
    
    var rowsToAppend = newAttendees.map(function(att) {
      var payloadRow = new Array(headers.length).fill("");
      if (colMap["timestamp_col"] !== undefined) payloadRow[colMap["timestamp_col"]] = ts;
      if (colMap["resident_col"] !== undefined) payloadRow[colMap["resident_col"]] = att.name;
      if (colMap["email_col"] !== undefined) payloadRow[colMap["email_col"]] = att.email;
      if (colMap["date_col"] !== undefined) payloadRow[colMap["date_col"]] = dateStr;
      if (colMap["topic_col"] !== undefined) payloadRow[colMap["topic_col"]] = topicStr || "Manual Entry";
      if (colMap["status"] !== undefined) payloadRow[colMap["status"]] = att.points > 0 ? "Attended" : "Absent";
      if (colMap["points_col"] !== undefined) payloadRow[colMap["points_col"]] = Number(att.points) || 0;
      return payloadRow;
    });
    
    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }
    SpreadsheetApp.flush();
    return "Success: Logged attendance for " + newAttendees.length + " residents.";
  } catch(e) { 
    return "Error: " + e.toString(); 
  } finally { 
    lock.releaseLock(); 
  }
}

// --- LIVE SCHEDULE PARSER ---

function syncLiveSchedule() {
  if (SCHEDULE_SHEET_ID === "PASTE_YOUR_LIVE_SCHEDULE_SHEET_ID_HERE") return "Error: Please paste your Live Schedule Google Sheet ID into the top of the backend script first.";
  
  try {
    var liveSS = SpreadsheetApp.openById(SCHEDULE_SHEET_ID);
    var sheets = liveSS.getSheets();
    var scheduleMap = {}; 

    sheets.forEach(function(sheet) {
      var data = sheet.getDataRange().getValues();
      for (var r = 0; r < data.length; r++) {
        var colA = String(data[r][0]).trim();
        
        if (colA.match(/^[1-5]$/)) {
          for (var c = 1; c <= 5; c++) {
            var dateCell = data[r][c];
            if (!dateCell) continue;

            var d = new Date(dateCell);
            if (isNaN(d.getTime())) continue; 
            var dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");

            var topics = [];
            var scanRow = r + 1;
            
            while (scanRow < data.length && !String(data[scanRow][0]).trim().match(/^[1-5]$/)) {
               var cellText = String(data[scanRow][c]).trim();
               if (cellText) topics.push(cellText);
               scanRow++;
            }
            
            if (topics.length > 0) {
                scheduleMap[dateStr] = topics.join(" | ").replace(/\n/g, " ");
            }
          }
        }
      }
    });

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var destSheet = ss.getSheetByName("Daily_Schedule");
    if (!destSheet) destSheet = ss.insertSheet("Daily_Schedule");
    
    if (destSheet.getLastRow() > 1) destSheet.getRange(2, 1, destSheet.getLastRow() - 1, 2).clearContent();

    var rows = [];
    for (var ds in scheduleMap) {
        rows.push([ds, scheduleMap[ds]]);
    }
    
    rows.sort(function(a, b) { return a[0].localeCompare(b[0]); });
    if (rows.length > 0) destSheet.getRange(2, 1, rows.length, 2).setValues(rows);
    
    SpreadsheetApp.flush();
    return "Successfully synced " + rows.length + " dates from the Live Schedule!";
  } catch(e) {
    return "Error: " + e.toString();
  }
}

function getDailySchedule() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Daily_Schedule");
    if (!sheet || sheet.getLastRow() < 2) return {};
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    var map = {};
    for (var i=0; i<data.length; i++) {
        var d = data[i][0];
        var dStr = (d instanceof Date) ? Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(d);
        map[dStr] = String(data[i][1]);
    }
    return map;
  } catch(e) { return {}; }
}

function getBlockSchedule() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Block_Schedule");
    if (!sheet || sheet.getLastRow() < 2) return [];
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
    var today = new Date();
    return data.filter(function(r) { return r[0]; }).map(function(r) {
      var startDate = r[1] instanceof Date ? r[1] : new Date(r[1]);
      var endDate   = r[2] instanceof Date ? r[2] : new Date(r[2]);
      endDate.setHours(23, 59, 59, 999);
      return {
        title:     String(r[0]),
        startDate: Utilities.formatDate(startDate, Session.getScriptTimeZone(), "yyyy-MM-dd"),
        endDate:   Utilities.formatDate(endDate,   Session.getScriptTimeZone(), "yyyy-MM-dd"),
        isPast:    endDate < today
      };
    });
  } catch(e) {
    Logger.log("getBlockSchedule error: " + e.toString());
    return [];
  }
}

// --- PDF REPORT GENERATION (EXPANDED TO MULTI-PAGE) ---

function calculateAttendanceTarget(pgyString) {
  if (!pgyString) return 0;
  var lowPgy = String(pgyString).toLowerCase().trim();
  if (lowPgy === 'faculty') return 0; // Faculty have no point target

  var match = String(pgyString).match(/20\d{2}/);
  if (!match) return 100;
  var gradYear = parseInt(match[0]);
  var today = new Date();
  var academicEndYear = today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear();
  var pgyLevel = 3 - (gradYear - academicEndYear);
  var clampedLevel = Math.max(1, Math.min(3, pgyLevel));
  return clampedLevel * 100;
}

function emailMasterReportPDF(targetEmail, advisorFilter) {
  // ---- INNER RISK HELPER ----
  var _blockSched = getBlockSchedule();
  var _today = new Date();
  var _pastBlocks = _blockSched.filter(function(b) { return b.isPast; });
  var _pastBlockCount = _pastBlocks.length;

  var getBlockTiming = function(historyItem) {
    if (!historyItem || !historyItem.topic) return null;
    var cleanTopic = historyItem.topic.toLowerCase().trim();
    // Match "Block 1: Full Title..." against schedule entry "Block 1" using prefix check
    var b = _blockSched.find(function(blk) {
      var blkTitle = blk.title.toLowerCase().trim();
      return cleanTopic === blkTitle || cleanTopic.indexOf(blkTitle + ':') === 0 || cleanTopic.indexOf(blkTitle + ' ') === 0;
    });
    if (!b) return { label: "\u2014", emoji: "", color: "#94a3b8" };
    
    var hd = new Date(historyItem.date);
    if (isNaN(hd.getTime())) return { label: "-", emoji: "", color: "#64748b" };
    
    var bs = new Date(b.startDate); bs.setHours(0,0,0,0);
    var be = new Date(b.endDate); be.setHours(23,59,59,999);
    
    if (hd < bs) return { label: "Early", emoji: "\u26A1", color: "#d97706" };
    if (hd > be) return { label: "Late", emoji: "\u23F0", color: "#dc2626" };
    return { label: "On Time", emoji: "\u2705", color: "#059669" };
  };

  var computeRisk = function(r) {
    var onTimeCount = 0;
    if (_pastBlockCount > 0 && r.history && r.history.length > 0) {
      _pastBlocks.forEach(function(block) {
        var bs = new Date(block.startDate); bs.setHours(0,0,0,0);
        var be = new Date(block.endDate);   be.setHours(23,59,59,999);
        var hit = r.history.some(function(h) {
          var hd = new Date(h.date);
          return !isNaN(hd.getTime()) && hd >= bs && hd <= be;
        });
        if (hit) onTimeCount++;
      });
    }
    
    var onTimeRate = _pastBlockCount > 0 ? onTimeCount / _pastBlockCount : 1.0;
    var avg = r.attempts > 0 ? r.average : 0;
    
    // --- ATTENDANCE TRACKING ---
    var attTarget = calculateAttendanceTarget(r.pgy);
    var actualAtt = r.totalAttendancePoints || 0;
    var attLevel = attTarget > 0 ? (actualAtt >= attTarget * 0.9 ? 'green' : actualAtt >= attTarget * 0.75 ? 'yellow' : 'red') : 'green';

    var isAtRisk   = (r.attempts > 0 && avg < AT_RISK_AVG_THRESHOLD) || (_pastBlockCount > 0 && onTimeRate < AT_RISK_ONTIME_THRESHOLD) || (attLevel === 'red');
    var isConcern  = !isAtRisk && ((r.attempts > 0 && avg < CONCERN_AVG_THRESHOLD) || (_pastBlockCount > 0 && onTimeRate < CONCERN_ONTIME_THRESHOLD) || (attLevel === 'yellow'));
    
    var reasons = [];
    if (avg > 0 && avg < AT_RISK_AVG_THRESHOLD) reasons.push('Avg ' + avg + '% (below ' + AT_RISK_AVG_THRESHOLD + '%)');
    else if (avg > 0 && avg < CONCERN_AVG_THRESHOLD) reasons.push('Avg ' + avg + '% (below ' + CONCERN_AVG_THRESHOLD + '%)');
    
    if (_pastBlockCount > 0) {
      var pct = Math.round(onTimeRate * 100);
      if (pct < Math.round(AT_RISK_ONTIME_THRESHOLD * 100)) reasons.push('On-time: ' + pct + '% (below ' + Math.round(AT_RISK_ONTIME_THRESHOLD * 100) + '%)');
      else if (pct < Math.round(CONCERN_ONTIME_THRESHOLD * 100)) reasons.push('On-time: ' + pct + '% (below ' + Math.round(CONCERN_ONTIME_THRESHOLD * 100) + '%)');
    }

    if (attLevel === 'red') reasons.push('Attendance: ' + actualAtt + '/' + attTarget + ' (Critical)');
    else if (attLevel === 'yellow') reasons.push('Attendance: ' + actualAtt + '/' + attTarget + ' (Behind)');

    return { level: isAtRisk ? 'red' : isConcern ? 'yellow' : 'green', onTimeCount: onTimeCount, onTimePct: Math.round(onTimeRate*100), reasons: reasons };
  };
  // ---- END RISK HELPER ----

  try {
    var allStats = getAdminStats();
    if (!allStats || allStats.length === 0) return "Error: No data available in Results or Roster.";
    
    var stats = allStats;
    if (advisorFilter) {
      stats = allStats.filter(function(r) { return (r.advisor || "") === advisorFilter; });
      if (stats.length === 0) return "Error: No data found for advisor " + advisorFilter;
    }
    
    // Exclude alumni (residents whose "Class of YYYY" graduation year has passed)
    var now = new Date();
    var currentAcadYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1; // July = new academic year
    stats = stats.filter(function(r) {
      var pgy = String(r.pgy || "");
      var match = pgy.match(/class of (\d{4})/i);
      if (!match) return true; // keep if no class year
      var gradYear = parseInt(match[1]);
      return gradYear > currentAcadYear; // exclude if graduated
    });
    
    var grouped = {};
    stats.forEach(function(r) {
      var pgy = r.pgy || "Other";
      r.totalPoints = r.totalAttendancePoints + (r.brqPoints || 0); // Calculate summary points based on actual points
      
      if (!grouped[pgy]) grouped[pgy] = [];
      grouped[pgy].push(r);
    });
    
    var html = "<div style='font-family: Arial, sans-serif; color: #333;'>";
    if (advisorFilter) {
      html += "<h2 style='color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 10px;'>FMC Academic Points Report - Advisor: " + advisorFilter + "</h2>";
    } else {
      html += "<h2 style='color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 10px;'>FMC Academic Points Master Report</h2>";
    }
    
    html += "<div style='margin-bottom: 20px; padding: 10px; background-color: #eff6ff; border-radius: 5px; border-left: 4px solid #3b82f6;'>";
    html += "<a href='https://rtm.theabfm.org/bayesian/predictor' target='_blank' style='color: #1d4ed8; font-weight: bold; text-decoration: none;'>&#128279; Launch ABFM Bayesian Score Predictor</a>";
    html += "<p style='font-size: 11px; color: #475569; margin: 5px 0 0 0;'>Use this tool with USMLE/COMLEX and ITE scores to predict ABFM board readiness.</p>";
    html += "</div>";

    html += "<p style='font-size: 12px; color: #64748b;'>Generated on: " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm") + "</p>";

    // --- FLAG & TIMING LEGEND ---
    html += "<div style='margin: 12px 0 18px 0; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11px; color: #334155; line-height: 1.7;'>";
    html += "<strong style='color:#0f172a; font-size:12px;'>&#x1F6A9; Performance Flags</strong><br>";
    html += "&#x1F534; <strong style='color:#dc2626'>At Risk</strong>: Overall avg &lt; " + AT_RISK_AVG_THRESHOLD + "% <em>or</em> &lt; " + Math.round(AT_RISK_ONTIME_THRESHOLD * 100) + "% of assigned blocks completed on time&nbsp;&nbsp;&bull;&nbsp;&nbsp;";
    html += "&#x1F7E1; <strong style='color:#d97706'>Needs Attention</strong>: avg &lt; " + CONCERN_AVG_THRESHOLD + "% <em>or</em> &lt; " + Math.round(CONCERN_ONTIME_THRESHOLD * 100) + "% on-time&nbsp;&nbsp;&bull;&nbsp;&nbsp;";
    html += "&#x1F7E2; <strong style='color:#059669'>On Track</strong>";
    html += "<div style='border-top:1px solid #cbd5e1; margin:6px 0 4px 0;'></div>";
    html += "<strong style='color:#0f172a; font-size:12px;'>&#x23F1; Block Completion Timings</strong><br>";
    html += "&#x26A1; <strong style='color:#d97706'>Early</strong>: Taken before block started&nbsp;&nbsp;&bull;&nbsp;&nbsp;";
    html += "&#x2705; <strong style='color:#059669'>On Time</strong>: Taken inside block window&nbsp;&nbsp;&bull;&nbsp;&nbsp;";
    html += "&#x23F0; <strong style='color:#dc2626'>Late</strong>: Taken after block ended";
    html += "</div>";

    // --- AGGREGATE SUMMARY METRICS (FOR CARDS) ---
    var residentStats = stats.filter(function(r) { return !r.isFaculty; });
    var avgBoardReady = residentStats.length > 0 ? Math.round(residentStats.reduce(function(acc, r) { return acc + (r.average || 0); }, 0) / residentStats.length) : 0;
    var onTrackAttendance = residentStats.filter(function(r) { return computeRisk(r).reasons.every(function(rs) { return rs.indexOf('Attendance') === -1 || rs.indexOf('Critical') === -1; }); }).length;
    var attPercent = residentStats.length > 0 ? Math.round((onTrackAttendance / residentStats.length) * 100) : 0;
    var avgOnTime = residentStats.length > 0 ? Math.round(residentStats.reduce(function(acc, r) { return acc + computeRisk(r).onTimePct; }, 0) / residentStats.length) : 0;
    var coreMetric = Math.round((avgBoardReady + avgOnTime) / 2);

    // --- SUMMARY HEADER CARDS ---
    html += "<div style='display: table; width: 100%; border-spacing: 10px; margin-bottom: 25px;'>";
    
    // Card 1: Board Readiness
    html += "<div style='display: table-cell; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; width: 33%; text-align: center;'>";
    html += "<div style='color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;'>Board Readiness</div>";
    html += "<div style='color: #1e3a8a; font-size: 24px; font-weight: 900;'>" + avgBoardReady + "%</div>";
    html += "<div style='color: #94a3b8; font-size: 10px; margin-top: 3px;'>Group Avg Score</div>";
    html += "</div>";

    // Card 2: Attendance
    html += "<div style='display: table-cell; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; width: 33%; text-align: center;'>";
    html += "<div style='color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;'>Attendance</div>";
    html += "<div style='color: #059669; font-size: 24px; font-weight: 900;'>" + attPercent + "%</div>";
    html += "<div style='color: #94a3b8; font-size: 10px; margin-top: 3px;'>On Track (Green)</div>";
    html += "</div>";

    // Card 3: Core Metrics
    html += "<div style='display: table-cell; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 15px; width: 33%; text-align: center;'>";
    html += "<div style='color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;'>Core Metrics</div>";
    html += "<div style='color: #4f46e5; font-size: 24px; font-weight: 900;'>" + coreMetric + "%</div>";
    html += "<div style='color: #94a3b8; font-size: 10px; margin-top: 3px;'>Overall Program Health</div>";
    html += "</div>";
    
    html += "</div>";

    // --- AT-RISK SUMMARY ---
    var atRiskList    = residentStats.filter(function(r) { return computeRisk(r).level === 'red'; });
    var concernList   = residentStats.filter(function(r) { return computeRisk(r).level === 'yellow'; });
    if (atRiskList.length > 0 || concernList.length > 0) {
      html += "<div style='margin: 0 0 20px 0; padding: 14px 16px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px;'>";
      html += "<h3 style='color: #9a3412; margin: 0 0 12px 0; font-size: 14px;'>&#x26A0;&#xFE0F; Residents Needing Attention</h3>";
      var riskTblStyle = "width:100%; border-collapse:collapse; font-size:12px; margin-bottom:10px;";
      var thStyle = "padding:5px 8px; border:1px solid #{}; text-align:left;";
      if (atRiskList.length > 0) {
        html += "<p style='font-size:11px; color:#dc2626; font-weight:bold; margin:0 0 5px 0;'>&#x1F534; At Risk (" + atRiskList.length + ")</p>";
        html += "<table style='" + riskTblStyle + "'><tr style='background:#fee2e2;'><th style='padding:5px 8px;border:1px solid #fca5a5;'>Resident</th><th style='padding:5px 8px;border:1px solid #fca5a5;'>Class</th><th style='padding:5px 8px;border:1px solid #fca5a5;'>Advisor</th><th style='padding:5px 8px;border:1px solid #fca5a5;text-align:center;'>Avg</th><th style='padding:5px 8px;border:1px solid #fca5a5;text-align:center;'>On-Time Blocks</th><th style='padding:5px 8px;border:1px solid #fca5a5;'>Reason</th></tr>";
        atRiskList.forEach(function(r) { var rsk = computeRisk(r); html += "<tr><td style='padding:5px 8px;border:1px solid #fca5a5;font-weight:bold;'>" + r.name + "</td><td style='padding:5px 8px;border:1px solid #fca5a5;'>" + (r.pgy||'') + "</td><td style='padding:5px 8px;border:1px solid #fca5a5;'>" + (r.advisor||'') + "</td><td style='padding:5px 8px;border:1px solid #fca5a5;text-align:center;font-weight:bold;color:#dc2626;'>" + (r.attempts > 0 ? r.average + '%' : '--') + "</td><td style='padding:5px 8px;border:1px solid #fca5a5;text-align:center;'>" + rsk.onTimeCount + "/" + _pastBlockCount + " (" + rsk.onTimePct + "%)</td><td style='padding:5px 8px;border:1px solid #fca5a5;font-size:11px;color:#dc2626;'>" + rsk.reasons.join('; ') + "</td></tr>"; });
        html += "</table>";
      }
      if (concernList.length > 0) {
        html += "<p style='font-size:11px; color:#d97706; font-weight:bold; margin:0 0 5px 0;'>&#x1F7E1; Needs Attention (" + concernList.length + ")</p>";
        html += "<table style='" + riskTblStyle + "'><tr style='background:#fef3c7;'><th style='padding:5px 8px;border:1px solid #fcd34d;'>Resident</th><th style='padding:5px 8px;border:1px solid #fcd34d;'>Class</th><th style='padding:5px 8px;border:1px solid #fcd34d;'>Advisor</th><th style='padding:5px 8px;border:1px solid #fcd34d;text-align:center;'>Avg</th><th style='padding:5px 8px;border:1px solid #fcd34d;text-align:center;'>On-Time Blocks</th></tr>";
        concernList.forEach(function(r) { var rsk = computeRisk(r); html += "<tr><td style='padding:5px 8px;border:1px solid #fcd34d;font-weight:bold;'>" + r.name + "</td><td style='padding:5px 8px;border:1px solid #fcd34d;'>" + (r.pgy||'') + "</td><td style='padding:5px 8px;border:1px solid #fcd34d;'>" + (r.advisor||'') + "</td><td style='padding:5px 8px;border:1px solid #fcd34d;text-align:center;font-weight:bold;color:#d97706;'>" + (r.attempts > 0 ? r.average + '%' : '--') + "</td><td style='padding:5px 8px;border:1px solid #fcd34d;text-align:center;'>" + rsk.onTimeCount + "/" + _pastBlockCount + " (" + rsk.onTimePct + "%)</td></tr>"; });
        html += "</table>";
      }
      html += "</div>";
    }

    var renderTable = function(title, resList) {
      if (resList.length === 0) return "";
      var t = "<h3 style='background-color: #f1f5f9; padding: 10px; border-radius: 5px; color: #0f172a; margin-top: 25px;'>" + title + "</h3>";
      t += "<table style='width: 100%; border-collapse: collapse; font-size: 13px;'>";
      t += "<tr style='background-color: #e2e8f0; text-align: left;'>";
      t += "<th style='padding: 8px; border: 1px solid #cbd5e1;'>Resident</th>";
      t += "<th style='padding: 8px; border: 1px solid #cbd5e1;'>Advisor</th>";
      t += "<th style='padding: 8px; border: 1px solid #cbd5e1; text-align: center;'>Att. Pts</th>";
      t += "<th style='padding: 8px; border: 1px solid #cbd5e1; text-align: center;'>Quiz Pts</th>";
      t += "<th style='padding: 8px; border: 1px solid #cbd5e1; text-align: center;'>Total Pts</th>";
      t += "<th style='padding: 8px; border: 1px solid #cbd5e1; text-align: center;'>Blocks Complete</th>";
      t += "<th style='padding: 8px; border: 1px solid #cbd5e1; text-align: center;'>Timing (E|O|L)</th>";
      t += "<th style='padding: 8px; border: 1px solid #cbd5e1; text-align: center; color: #1e3a8a;'>Overall Avg</th>";
      t += "</tr>";
      
      resList.forEach(function(r) {
        var rsk = computeRisk(r);
        var ec=0, oc=0, lc=0;
        if (r.history) {
            r.history.forEach(function(h) {
                var tm = getBlockTiming(h);
                if (tm) {
                    if (tm.label==='Early') ec++;
                    else if (tm.label==='On Time') oc++;
                    else if (tm.label==='Late') lc++;
                }
            });
        }
        var timingHTML = "<span style='color:#d97706;font-weight:bold;'>&#x26A1;" + ec + "</span> <span style='color:#cbd5e1;'>|</span> <span style='color:#059669;font-weight:bold;'>&#x2705;" + oc + "</span> <span style='color:#cbd5e1;'>|</span> <span style='color:#dc2626;font-weight:bold;'>&#x23F0;" + lc + "</span>";

        var riskEmoji = rsk.level === 'red' ? '&#x1F534; ' : rsk.level === 'yellow' ? '&#x1F7E1; ' : '&#x1F7E2; ';
        t += "<tr>";
        t += "<td style='padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;'>" + riskEmoji + r.name + "</td>";
        t += "<td style='padding: 8px; border: 1px solid #cbd5e1; color: #64748b;'>" + r.advisor + "</td>";
        t += "<td style='padding: 8px; border: 1px solid #cbd5e1; text-align: center;'>" + r.totalAttendancePoints + "</td>";
        t += "<td style='padding: 8px; border: 1px solid #cbd5e1; text-align: center;'>" + (r.brqPoints || 0) + "</td>";
        t += "<td style='padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #7e22ce;'>" + r.totalPoints + "</td>";
        t += "<td style='padding: 8px; border: 1px solid #cbd5e1; text-align: center;'>" + r.assignedBlocksCompleted + "</td>";
        t += "<td style='padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-size:11px; white-space:nowrap;'>" + timingHTML + "</td>";
        t += "<td style='padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #1e3a8a;'>" + (r.attempts > 0 ? r.average + "%" : "--") + "</td>";
        t += "</tr>";
      });

      t += "</table>";
      return t;
    };
    
    var pgyKeys = Object.keys(grouped).sort();
    pgyKeys.forEach(function(key) {
      html += renderTable(key, grouped[key]);
    });
    
    // --- INDIVIDUAL RESIDENT REPORT PAGES ---
    stats.forEach(function(r) {
       var rsk = computeRisk(r);
       html += "<div style='page-break-before: always;'></div>";
       // Risk banner
       if (rsk.level === 'red') {
         html += "<div style='background:#fee2e2;border:2px solid #dc2626;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#991b1b;'>&#x1F534; <strong>At Risk</strong> &mdash; " + rsk.reasons.join(' &bull; ') + "</div>";
       } else if (rsk.level === 'yellow') {
         html += "<div style='background:#fef3c7;border:2px solid #d97706;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#92400e;'>&#x1F7E1; <strong>Needs Attention</strong> &mdash; " + rsk.reasons.join(' &bull; ') + "</div>";
       }
       html += "<div style='border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; display: table; width: 100%;'>";
       html += "<div style='display: table-cell; vertical-align: bottom;'>";
       html += "<h2 style='color: #0f172a; margin: 0; font-size: 22px; font-weight: 900;'>" + r.name + "</h2>";
       html += "<div style='color: #64748b; font-size: 12px; font-weight: bold; margin-top: 4px;'>Class of " + r.pgy + " &bull; Advisor: " + r.advisor + "</div>";
       html += "</div>";
       html += "<div style='display: table-cell; text-align: right; vertical-align: bottom;'>";
       html += "<span style='background: #f1f5f9; border: 1px solid #e2e8f0; padding: 4px 10px; border-radius: 20px; color: #1e3a8a; font-size: 11px; font-weight: bold;'>SCORE: " + (r.attempts > 0 ? r.average + '%' : 'N/A') + "</span>";
       html += "</div>";
       html += "</div>";

       // BLOCK PROGRESS SNAPSHOT TABLE
       html += "<h4 style='font-size: 12px; color: #1e3a8a; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 1px;'>Block Progress Snapshot</h4>";
       html += "<table style='width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;'>";
       html += "<tr style='background: #f8fafc;'>";
       html += "<th style='padding: 8px; border: 1px solid #e2e8f0; text-align: left;'>Academic Block</th>";
       html += "<th style='padding: 8px; border: 1px solid #e2e8f0; text-align: center; width: 100px;'>Status</th>";
       html += "<th style='padding: 8px; border: 1px solid #e2e8f0; text-align: center; width: 100px;'>Timing</th>";
       html += "<th style='padding: 8px; border: 1px solid #e2e8f0; text-align: center; width: 80px;'>Score</th>";
       html += "</tr>";

       _blockSched.forEach(function(blk) {
         var hit = (r.history || []).find(function(h) {
           var hd = new Date(h.date);
           var bs = new Date(blk.startDate); bs.setHours(0,0,0,0);
           var be = new Date(blk.endDate);   be.setHours(23,59,59,999);
           return !isNaN(hd.getTime()) && hd >= bs && hd <= be;
         });
         
         var tm = hit ? getBlockTiming(hit) : null;
         var statusEmoji = hit ? "&#x2705;" : blk.isPast ? "&#x274C;" : "&#x231B;";
         var statusText = hit ? "Complete" : blk.isPast ? "Incomplete" : "Future";
         var statusColor = hit ? "#059669" : blk.isPast ? "#dc2626" : "#64748b";

         html += "<tr>";
         html += "<td style='padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;'>" + blk.title + ": " + blk.topic + "</td>";
         html += "<td style='padding: 8px; border: 1px solid #e2e8f0; text-align: center; color: " + statusColor + "; font-weight: bold;'>" + statusEmoji + " " + statusText + "</td>";
         html += "<td style='padding: 8px; border: 1px solid #e2e8f0; text-align: center; color: " + (tm ? tm.color : '#94a3b8') + "; font-weight: bold;'>" + (tm ? tm.label : '\u2014') + "</td>";
         html += "<td style='padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;'>" + (hit ? hit.percentage + '%' : '\u2014') + "</td>";
         html += "</tr>";
       });
       html += "</table>";

       // KPI Row
       html += "<table style='width: 100%; border-collapse: collapse; margin-bottom: 20px; text-align: center;'><tr>";
       html += "<td style='padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc;'><div style='font-size:10px; color:#64748b; text-transform:uppercase;'>Overall Avg</div><div style='font-size:18px; font-weight:bold; color:#1e3a8a;'>" + (r.attempts > 0 ? r.average + "%" : "--") + "</div></td>";
       html += "<td style='padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc;'><div style='font-size:10px; color:#64748b; text-transform:uppercase;'>Total Pts</div><div style='font-size:18px; font-weight:bold; color:#7e22ce;'>" + r.totalPoints + "</div></td>";
       html += "<td style='padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc;'><div style='font-size:10px; color:#64748b; text-transform:uppercase;'>Quiz Pts</div><div style='font-size:18px; font-weight:bold; color:#d97706;'>" + (r.brqPoints || 0) + "</div></td>";
       html += "<td style='padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc;'><div style='font-size:10px; color:#64748b; text-transform:uppercase;'>Att. Pts</div><div style='font-size:18px; font-weight:bold; color:#059669;'>" + r.totalAttendancePoints + "</div></td>";
       html += "<td style='padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc;'><div style='font-size:10px; color:#64748b; text-transform:uppercase;'>Total Qs Done</div><div style='font-size:18px; font-weight:bold; color:#0f172a;'>" + r.totalQuestionsCompleted + "</div></td>";
       html += "<td style='padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc;'><div style='font-size:10px; color:#64748b; text-transform:uppercase;'>Assigned Blocks</div><div style='font-size:18px; font-weight:bold; color:#0f172a;'>" + r.assignedBlocksCompleted + "</div></td>";
       html += "</tr></table>";

       // Topic Breakdown Table
       if (r.topicAverages && r.topicAverages.length > 0) {
         html += "<h3 style='font-size: 14px; color: #334155; margin-bottom: 5px;'>Topic Mastery Breakdown</h3>";
         html += "<table style='width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;'>";
         html += "<tr style='background-color: #f1f5f9;'><th style='padding: 6px; border: 1px solid #cbd5e1; text-align: left;'>Category</th><th style='padding: 6px; border: 1px solid #cbd5e1; text-align: center;'>Questions Completed</th><th style='padding: 6px; border: 1px solid #cbd5e1; text-align: center;'>Average Score</th></tr>";
         r.topicAverages.forEach(function(t) {
           html += "<tr><td style='padding: 6px; border: 1px solid #cbd5e1;'>" + t.topic + "</td><td style='padding: 6px; border: 1px solid #cbd5e1; text-align: center;'>" + t.total + "</td><td style='padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;'>" + t.average + "%</td></tr>";
         });
         html += "</table>";
       }

       // Layout for History Tables (Side by Side)
       html += "<table style='width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px;'><tr style='vertical-align: top;'>";
       
       // Assessment History
       html += "<td style='width: 50%; padding-right: 10px;'>";
       html += "<h3 style='font-size: 14px; color: #334155; margin-top: 0; margin-bottom: 5px;'>Assessment History</h3>";
       if (r.history && r.history.length > 0) {
         html += "<table style='width: 100%; border-collapse: collapse;'>";
         html += "<tr style='background-color: #f1f5f9;'><th style='padding: 4px; border: 1px solid #cbd5e1; text-align: left;'>Date</th><th style='padding: 4px; border: 1px solid #cbd5e1; text-align: left;'>Topic</th><th style='padding: 4px; border: 1px solid #cbd5e1; text-align: center;'>Timing</th><th style='padding: 4px; border: 1px solid #cbd5e1; text-align: right;'>Score</th></tr>";
         var reversedHistory = r.history.slice().reverse(); // Newest first
         reversedHistory.forEach(function(h) {
           var tm = getBlockTiming(h);
           var tmHtml = tm && tm.label !== '-' ? "<span style='color:" + tm.color + "'>" + tm.emoji + " " + tm.label + "</span>" : "";
           html += "<tr><td style='padding: 4px; border: 1px solid #cbd5e1; white-space:nowrap;'>" + h.date + "</td><td style='padding: 4px; border: 1px solid #cbd5e1;'>" + h.topic + "</td><td style='padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px; font-weight: bold; white-space:nowrap;'>" + tmHtml + "</td><td style='padding: 4px; border: 1px solid #cbd5e1; text-align: right;'>" + h.percentage + "%</td></tr>";
         });
         html += "</table>";
       } else {
         html += "<p style='color: #94a3b8; font-style: italic;'>No blocks completed.</p>";
       }
       html += "</td>";

       // Attendance History
       html += "<td style='width: 50%; padding-left: 10px;'>";
       html += "<h3 style='font-size: 14px; color: #334155; margin-top: 0; margin-bottom: 5px;'>Attendance History</h3>";
       if (r.attendanceHistory && r.attendanceHistory.length > 0) {
         html += "<table style='width: 100%; border-collapse: collapse;'>";
         html += "<tr style='background-color: #f1f5f9;'><th style='padding: 4px; border: 1px solid #cbd5e1; text-align: left;'>Date</th><th style='padding: 4px; border: 1px solid #cbd5e1; text-align: left;'>Conference Topic</th></tr>";
         var reversedAtt = r.attendanceHistory.slice().reverse(); // Newest first
         reversedAtt.forEach(function(a) {
           html += "<tr><td style='padding: 4px; border: 1px solid #cbd5e1;'>" + a.date + "</td><td style='padding: 4px; border: 1px solid #cbd5e1;'>" + a.topic + "</td></tr>";
         });
         html += "</table>";
       } else {
         html += "<p style='color: #94a3b8; font-style: italic;'>No attendance recorded.</p>";
       }
       html += "</td>";

       html += "</tr></table>";
    });
    
    html += "</div>";
    
    var subject = advisorFilter ? "FMC Academic Points Report - Advisor: " + advisorFilter : "FMC Academic Points Master Report";
    var safeAdvName = advisorFilter ? advisorFilter.replace(/[^a-zA-Z0-9]/g, '_') + "_" : "Master_";
    var blobName = "FMC_Academic_Points_" + safeAdvName + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd") + ".pdf";

    var blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF).setName(blobName);
    
    var emailHtmlBody = "<div style='font-family: Arial, sans-serif;'><p>Please find the attached Academic Points Report detailing Attendance and Question Block completion. " + (advisorFilter ? "This report has been specifically filtered for your advisees." : "Each resident now has a dedicated page at the end of the report.") + "</p>";
    emailHtmlBody += "<div style='margin: 20px 0; padding: 15px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;'><h3 style='margin-top: 0; color: #0f172a;'>Board Readiness Tool</h3><p style='margin-bottom: 0;'><a href='https://rtm.theabfm.org/bayesian/predictor' style='color: #2563eb; font-weight: bold; text-decoration: none;'>Launch ABFM Bayesian Score Predictor &rarr;</a></p></div>";
    emailHtmlBody += "<p style='font-size: 12px; color: #64748b;'><i>Generated automatically by the FMC Board Question App &mdash; Ascension St. Vincent's Family Medicine Residency Program Jacksonville.</i></p></div>";

    MailApp.sendEmail({
      to: targetEmail,
      subject: subject,
      htmlBody: emailHtmlBody,
      attachments: [blob]
    });
    
    return "\u2705 Successfully sent PDF report to " + targetEmail;
  } catch (e) {
    return "Error generating PDF: " + e.toString();
  }   
}

// --- RESIDENT STATS TOOL ---

function getResidentProfile(email) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var targetEmail = String(email).toLowerCase().trim();
    var profile = {
      totalPoints: 0,
      brqPoints: 0,
      attPoints: 0,
      blocks: [],
      conferences: [],
      pgy: "Unknown",
      classAverage: 0,
      overallAverage: 0,
      categoryStats: {},
      totalQuestionsCompleted: 0,
      assignedBlocksCompleted: 0,
      customBlocksCompleted: 0,
      topicAverages: []
    };

    // 1. Get User's PGY from Roster
    var rosterSheet = ss.getSheetByName("Roster");
    var rosterData = rosterSheet ? rosterSheet.getDataRange().getValues() : [];
    var userPgy = "Unknown";
    var pgyEmails = []; 

    for (var i = 1; i < rosterData.length; i++) {
      var rEmail = String(rosterData[i][1]).toLowerCase().trim();
      var rPgy = String(rosterData[i][2]);
      if (rEmail === targetEmail) {
        userPgy = rPgy;
        profile.pgy = userPgy;
      }
    }
    
    for (var i = 1; i < rosterData.length; i++) {
      var rEmail = String(rosterData[i][1]).toLowerCase().trim();
      var rPgy = String(rosterData[i][2]);
      if (rEmail === targetEmail) {
        userPgy = rPgy;
        profile.pgy = userPgy;
      }
    }

    var EXCLUDED_EMAILS = ["jonathan.carbungco@ascension.org"];
    var excludedEmailsLower = EXCLUDED_EMAILS.map(function(e) { return e.toLowerCase().trim(); });
    
    // If Admin/Faculty, set a special PGY label for their profile view
    if (excludedEmailsLower.indexOf(targetEmail) !== -1) {
      userPgy = "Faculty Admin";
      profile.pgy = userPgy;
    }
    
    for (var i = 1; i < rosterData.length; i++) {
      var rEmail = String(rosterData[i][1]).toLowerCase().trim();
      var rPgy = String(rosterData[i][2]);
      if (rPgy === userPgy && rPgy !== "Unknown" && rPgy !== "Faculty Admin") {
        pgyEmails.push(rEmail);
      }
    }

    // 2. Get BRQ Points (DYNAMICALLY MAPPED)
    var resultsSheet = ss.getSheetByName("Results");
    var myTotalScore = 0;
    var myTotalPossible = 0;
    var classTotalScore = 0;
    var classTotalPossible = 0;

    if (resultsSheet && resultsSheet.getLastRow() > 1) {
      var resultsData = resultsSheet.getDataRange().getValues();
      var headers = resultsData[0];
      var hMap = {};
      for(var h = 0; h < headers.length; h++) {
         if(headers[h]) hMap[String(headers[h]).trim().toLowerCase()] = h;
      }
      
      var emailIdx = hMap["email"] !== undefined ? hMap["email"] : 2;
      var topicIdx = hMap["topic"] !== undefined ? hMap["topic"] : 3;
      var scoreIdx = hMap["correct"] !== undefined ? hMap["correct"] : (hMap["score"] !== undefined && hMap["percentage"] !== undefined ? hMap["score"] : 4);
      var totalIdx = hMap["total"] !== undefined ? hMap["total"] : 5;
      var catIdx = hMap["category stats"] !== undefined ? hMap["category stats"] : 7;
      var ptsIdx = hMap["academic points"] !== undefined ? hMap["academic points"] : 8;
      var timeIdx = hMap["timestamp"] !== undefined ? hMap["timestamp"] : 0;

      var EXCLUDED_EMAILS = ["jonathan.carbungco@ascension.org"];
      var excludedEmailsLower = EXCLUDED_EMAILS.map(function(e) { return e.toLowerCase().trim(); });

      for (var i = 1; i < resultsData.length; i++) {
        var rowEmail = String(resultsData[i][emailIdx] || "").toLowerCase().trim();
        var score = Number(resultsData[i][scoreIdx]) || 0;
        var total = Number(resultsData[i][totalIdx]) || 0;
        var pts = Number(resultsData[i][ptsIdx]) || 0;
        var topicStr = String(resultsData[i][topicIdx] || "");

        if (rowEmail === targetEmail) {
          // --- POINT DEDUPLICATION ---
          if (!profile.completedTopicsMap) profile.completedTopicsMap = {};
          var cleanTopic = topicStr.toLowerCase().trim();
          
          if (!profile.completedTopicsMap[cleanTopic]) {
            profile.brqPoints += pts;
            profile.completedTopicsMap[cleanTopic] = true;
            
            if (cleanTopic.match(/block\s*\d+/)) {
              profile.assignedBlocksCompleted++;
            } else {
              profile.customBlocksCompleted++;
            }
          }
          
          myTotalScore += score;
          myTotalPossible += total;
          profile.totalQuestionsCompleted += total;
          
          var percentage = total > 0 ? Math.round((score / total) * 100) : 0;
          var dateRaw = resultsData[i][timeIdx];
          var dateStr = dateRaw instanceof Date ? Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), "MM/dd/yyyy") : String(dateRaw || "");
          profile.blocks.push({
            date: dateStr,
            topic: topicStr,
            score: score, 
            total: total,
            percentage: percentage,
            points: pts
          });
          
          var granularStats = {};
          try { if (resultsData[i][catIdx]) granularStats = JSON.parse(resultsData[i][catIdx]); } catch(e) {}
          var hasGranular = Object.keys(granularStats).length > 0;
          
          if (hasGranular) {
            for (var cat in granularStats) {
              var rawCat = cat.split('(')[0].trim();
              var catKey = rawCat.toLowerCase();
              if (!profile.categoryStats[catKey]) {
                profile.categoryStats[catKey] = { display: rawCat, correct: 0, total: 0 };
              }
              profile.categoryStats[catKey].correct += granularStats[cat].correct;
              profile.categoryStats[catKey].total += granularStats[cat].total;
            }
          } else {
            var rawTopic = topicStr.split('(')[0].trim();
            var topicKey = rawTopic.toLowerCase();
            if (!profile.categoryStats[topicKey]) {
              profile.categoryStats[topicKey] = { display: rawTopic, correct: 0, total: 0 };
            }
            profile.categoryStats[topicKey].correct += score;
            profile.categoryStats[topicKey].total += total;
          }
        }
        
        if (pgyEmails.indexOf(rowEmail) > -1 && excludedEmailsLower.indexOf(rowEmail) === -1) {
          classTotalScore += score;
          classTotalPossible += total;
        }
      }
    }

    profile.overallAverage = myTotalPossible > 0 ? Math.round((myTotalScore / myTotalPossible) * 100) : 0;
    profile.classAverage = classTotalPossible > 0 ? Math.round((classTotalScore / classTotalPossible) * 100) : 0;

    profile.topicAverages = Object.keys(profile.categoryStats).map(function(k) {
      var tData = profile.categoryStats[k];
      return {
        topic: tData.display,
        total: tData.total,
        average: tData.total > 0 ? Math.round((tData.correct / tData.total) * 100) : 0,
        percentage: tData.total > 0 ? Math.round((tData.correct / tData.total) * 100) : 0
      };
    }).sort(function(a, b) { 
      if (b.total !== a.total) return b.total - a.total;
      return b.average - a.average; 
    });

    // 3. Get Attendance Points (DYNAMICALLY MAPPED)
    var attSheet = ss.getSheetByName("Attendance");
    if (attSheet && attSheet.getLastRow() > 1) {
      var attData = attSheet.getDataRange().getValues();
      var aHeaders = attData[0];
      var aMap = {};
      for(var h = 0; h < aHeaders.length; h++) {
         if(aHeaders[h]) aMap[String(aHeaders[h]).trim().toLowerCase()] = h;
      }
      var aEmailIdx = aMap["email"] !== undefined ? aMap["email"] : 2;
      var aDateIdx = aMap["conference date"] !== undefined ? aMap["conference date"] : 3;
      var aTopicIdx = aMap["topic"] !== undefined ? aMap["topic"] : 4;
      var aPtsIdx = aMap["academic points"] !== undefined ? aMap["academic points"] : 5;

      for (var i = 1; i < attData.length; i++) {
        if (String(attData[i][aEmailIdx] || "").toLowerCase().trim() === targetEmail) {
          var pts = Number(attData[i][aPtsIdx]) || 0;
          profile.attPoints += pts;
          profile.conferences.push({
            date: String(attData[i][aDateIdx] || ""), 
            topic: String(attData[i][aTopicIdx] || ""), 
            points: pts
          });
        }
      }
    }

    profile.totalPoints = profile.brqPoints + profile.attPoints;
    profile.blocks.reverse();
    profile.conferences.reverse();

    return profile;
  } catch (e) {
    return { error: e.toString() };
  }
}

function getLeaderboardStats() {
  var props = PropertiesService.getScriptProperties();
  var now = new Date().getTime();
  
  try {
    // 1. Check Cache (15-minute expiration)
    var cachedData = props.getProperty("LEADERBOARD_CACHE_JSON");
    var cachedTime = props.getProperty("LEADERBOARD_CACHE_TIME");
    if (cachedData && cachedTime && (now - parseInt(cachedTime)) < 15 * 60 * 1000) {
      return JSON.parse(cachedData);
    }
  } catch (e) {
    Logger.log("Leaderboard cache read error: " + e.toString());
  }

  try {
    var allStats = getAdminStats();
    var residents = [];
    var latestTime = 0;

    allStats.forEach(function(s) {
      if (s.isFaculty) return; 
      
      if (s.history && s.history.length > 0) {
        s.history.forEach(function(h) {
          var t = new Date(h.date).getTime(); 
          if(t > latestTime) latestTime = t;
        });
      }
      if (s.attendanceHistory && s.attendanceHistory.length > 0) {
        s.attendanceHistory.forEach(function(a) {
          var t = new Date(a.date).getTime(); 
          if(t > latestTime) latestTime = t;
        });
      }

      residents.push({
        name: s.name,
        pgy: s.pgy,
        brqPoints: s.brqPoints || 0,
        attPoints: s.totalAttendancePoints || 0,
        totalPoints: (s.brqPoints || 0) + (s.totalAttendancePoints || 0)
      });
    });

    // Sort residents by total points for the leaderboard
    residents.sort((a, b) => b.totalPoints - a.totalPoints);

    var lastUpdatedStr = latestTime > 0 ? Utilities.formatDate(new Date(latestTime), Session.getScriptTimeZone(), "MM/dd/yyyy") : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy");

    var result = {
      lastUpdated: lastUpdatedStr,
      residents: residents
    };
    
    // Update Cache
    props.setProperty("LEADERBOARD_CACHE_JSON", JSON.stringify(result));
    props.setProperty("LEADERBOARD_CACHE_TIME", now.toString());

    return result;
  } catch (e) {
    Logger.log("Leaderboard Error: " + e.toString());
    return { lastUpdated: "Unknown", residents: [] };
  }
}

function emailAllAdvisorReports() {
  try {
    var allStats = getAdminStats();
    if (!allStats || allStats.length === 0) return "Error: No data available.";
    
    var advMap = {};
    var now = new Date();
    var currentAcadYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    var activeStats = allStats.filter(function(r) {
      var pgy = String(r.pgy || "");
      var match = pgy.match(/class of (\d{4})/i);
      if (!match) return true;
      return parseInt(match[1]) > currentAcadYear;
    });

    activeStats.forEach(function(r) {
      if (r.advisor && r.advisor !== "Unassigned" && r.advisorEmail) {
        advMap[r.advisor] = r.advisorEmail;
      }
    });
    
    var keys = Object.keys(advMap);
    if (keys.length === 0) return "Error: No faculty advisors with emails found in the Roster sheet. Please ensure Column E 'Advisor Email' is filled.";
    
    var sentCount = 0;
    var errs = [];
    
    keys.forEach(function(adv) {
      var emailObj = advMap[adv];
      var result = emailMasterReportPDF(emailObj, adv); 
      
      if (result.indexOf("Error") > -1) {
         errs.push(adv + ": " + result);
         Logger.log(adv + " error: " + result);
      } else {
         sentCount++;
      }
    });
    
    if (errs.length > 0) return "Successfully sent " + sentCount + " reports. Encountered errors on: " + errs.join(", ");
    return "\u2705 Success! Sent " + sentCount + " tailored PDF reports to all configured faculty advisors.";
  } catch (e) {
    return "Mass Email Error: " + e.toString();
  }
}

/**
 * Checks Block Schedule and sends Midblock and Final reports.
 * Should be triggered daily via Apps Script Triggers.
 */
function checkAndSendAutomatedReports() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var blockSheet = ss.getSheetByName("Block_Schedule");
    if (!blockSheet || blockSheet.getLastRow() < 2) return "No Block Schedule";

    var data = blockSheet.getDataRange().getValues();
    var today = new Date();
    today.setHours(0,0,0,0);

    for (var i = 1; i < data.length; i++) {
        var start = new Date(data[i][1]);
        var end = new Date(data[i][2]);
        if (isNaN(start) || isNaN(end)) continue;

        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);

        var blockDuration = (end - start) / (1000 * 60 * 60 * 24);
        var midDate = new Date(start.getTime() + (blockDuration / 2) * (1000 * 60 * 60 * 24));
        midDate.setHours(0,0,0,0);

        // Check if today is the midblock or the end block date
        var isMidblock = (today.getTime() === midDate.getTime());
        var isFinal = (today.getTime() === end.getTime());

        if (isMidblock || isFinal) {
            var reportType = isMidblock ? "Midblock" : "Final";
            Logger.log("Triggering " + reportType + " Report for " + data[i][0]);
            // Currently relies on emailAllAdvisorReports. 
            // Future: pass reportType down so the PDF says "Midblock Report"
            emailAllAdvisorReports();
            return "Sent " + reportType + " reports for " + data[i][0];
        }
    }
    return "No reports triggered today.";
  } catch (e) {
    Logger.log("Automated Report Error: " + e.toString());
    return "Error: " + e.toString();
  }
}

/**
 * Bulk saves attendance records parsed from external reports (PDF/Excel)
 * Records: Array of { reportName: string, date: string (yyyy-mm-dd), topic: string, points: number }
 */
function saveImportedAttendance(records) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Attendance");
    if (!sheet) {
        sheet = ss.insertSheet("Attendance");
        sheet.appendRow(["Timestamp", "Resident", "Email", "Conference Date", "Topic", "Status", "Academic Points"]);
        sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#d9ead3");
        sheet.setFrozenRows(1);
    }
    
    var roster = getRoster(); 
    
    var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    var colMap = {};
    for (var i = 0; i < headers.length; i++) {
        if (!headers[i]) continue;
        var h = String(headers[i]).trim().toLowerCase();
        colMap[h] = i;
        if (h === "resident" || h === "name") colMap["resident_col"] = i;
        if (h === "topic" || h === "conference topic" || h === "subject") colMap["topic_col"] = i;
        if (h === "conference date" || h === "date") colMap["date_col"] = i;
        if (h === "status" || h === "present") colMap["status_col"] = i;
        if (h === "academic points" || h === "points") colMap["points_col"] = i;
        if (h === "email") colMap["email_col"] = i;
        if (h === "timestamp") colMap["timestamp_col"] = i;
    }
    
    // --- DEDUPLICATION MAP ---
    var existingData = sheet.getLastRow() > 1 ? sheet.getDataRange().getValues() : [];
    var existingMap = {};
    for (var i = 1; i < existingData.length; i++) {
        var row = existingData[i];
        var eEmail = String(row[colMap["email_col"]] || "").toLowerCase().trim();
        var eDateRaw = row[colMap["date_col"]];
        var eDate = eDateRaw instanceof Date ? Utilities.formatDate(eDateRaw, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(eDateRaw).trim();
        var eTopic = String(row[colMap["topic_col"]] || "").toLowerCase().trim();
        var key = eEmail + "|" + eDate + "|" + eTopic;
        existingMap[key] = true;
    }

    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm");
    var rowsToAppend = [];
    var matchedCount = 0;
    var skippedCount = 0;
    var failedNamesMap = {}; // Tracks unique failed names
    
    // --- Load Name Aliases once outside the loop ---
    var aliasMap = {};
    var aliasSheet = ss.getSheetByName("Name_Aliases");
    if (aliasSheet && aliasSheet.getLastRow() > 1) {
        var aliasData = aliasSheet.getDataRange().getValues();
        for (var a = 1; a < aliasData.length; a++) {
            var fromName = String(aliasData[a][0]).trim().toLowerCase();
            var toName = String(aliasData[a][1]).trim();
            if (fromName && toName) aliasMap[fromName] = toName;
        }
    }

    records.forEach(function(rec) {
        var reportName = (rec.reportName || "").trim();
        var matchedName = aliasMap[reportName.toLowerCase()] || reportName;

        var matchedResident = matchResidentByName(matchedName, roster, aliasMap);
        if (!matchedResident) {
            failedNamesMap[reportName] = true;
            return;
        }
        
        var dateStr = rec.date; 
        var topicStr = (rec.category ? rec.category + ": " : "") + (rec.topic || "Unknown Conference");
        var points = (rec.points !== undefined) ? Number(rec.points) : 1;
        
        var key = matchedResident.email.toLowerCase().trim() + "|" + dateStr + "|" + topicStr.toLowerCase().trim();
        
        if (existingMap[key]) {
            skippedCount++;
            return;
        }
        
        var payloadRow = new Array(headers.length).fill("");
        payloadRow[colMap["timestamp_col"]] = ts;
        payloadRow[colMap["resident_col"]] = matchedResident.name;
        payloadRow[colMap["email_col"]] = matchedResident.email;
        payloadRow[colMap["date_col"]] = dateStr;
        payloadRow[colMap["topic_col"]] = topicStr;
        
        if (colMap["status_col"] !== undefined) {
          payloadRow[colMap["status_col"]] = rec.status || (points > 0 ? "Attended" : "Absent");
        }
        
        if (colMap["points_col"] !== undefined) payloadRow[colMap["points_col"]] = points;
        
        rowsToAppend.push(payloadRow);
        existingMap[key] = true; 
        matchedCount++;
    });
    
    if (rowsToAppend.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }
    
    SpreadsheetApp.flush();
    
    var msg = "Import Complete!\n\n";
    msg += "\u2705 " + matchedCount + " new entries added successfully.\n";
    
    if (skippedCount > 0) {
        msg += "\uD83D\uDCCB " + skippedCount + " duplicates skipped (already in sheet).\n";
    }
    
    var failedUnique = Object.keys(failedNamesMap);
    if (failedUnique.length > 0) {
        msg += "\n\u26A0\uFE0F " + failedUnique.length + " residents could not be found in the Roster:\n";
        msg += "- " + failedUnique.sort().join("\n- ");
        msg += "\n\n(Tip: Ensure their names in the report match or are similar to the Roster's 'Resident Name' column.)";
    }
    
    return msg;
    
  } catch(e) { 
    return "Error: " + e.toString(); 
  } finally { 
    lock.releaseLock(); 
  }
}



/**
 * Intelligent name matching to map "Report Names" to Roster entries.
 */
function getNameOverrides() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Name_Aliases");
    if (!sheet) {
      sheet = ss.insertSheet("Name_Aliases");
      sheet.appendRow(["Report Name", "Correct Roster Name"]);
      sheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#f1f5f9");
      sheet.setFrozenRows(1);
      return {};
    }
    var data = sheet.getDataRange().getValues();
    var overrides = {};
    for (var i = 1; i < data.length; i++) {
      var reportName = String(data[i][0] || "").toLowerCase().trim();
      var rosterName = String(data[i][1] || "").trim();
      if (reportName && rosterName) {
        overrides[reportName] = rosterName;
      }
    }
    return overrides;
  } catch (e) {
    console.error("Error loading name overrides: " + e.message);
    return {};
  }
}

/**
 * Saves a permanent alias mapping from a report name to the official roster name.
 */
function saveNameOverride(reportName, rosterName) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Name_Aliases");
    if (!sheet) {
        sheet = ss.insertSheet("Name_Aliases");
        sheet.appendRow(["Report Name", "Roster Name"]);
        sheet.setFrozenRows(1);
    }
    
    // Check if alias already exists
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).toLowerCase() === String(reportName).toLowerCase()) {
            return "Alias already exists.";
        }
    }
    
    sheet.appendRow([reportName, rosterName]);
    SpreadsheetApp.flush();
    return "Saved alias successfully.";
  } catch (e) {
    return "Error saving alias: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

function matchResidentByName(reportName, roster, optionalOverrides) {
  if (!reportName) return null;
  
  // Standardize cleaning: keep only letters and spaces for comparison
  var cleanStr = function(s) { 
      return (s || "").toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim(); 
  };
  
  var cleanReport = cleanStr(reportName);
  var reportParts = reportName.split(",");
  var normalizedReport = "";
  
  // Handle "Last, First" vs "First Last"
  if (reportParts.length > 1) {
      normalizedReport = cleanStr(reportParts[1]) + " " + cleanStr(reportParts[0]);
  } else {
      normalizedReport = cleanReport;
  }
  normalizedReport = normalizedReport.trim();

  // 0. Check Overrides (Highest priority)
  var overrides = optionalOverrides || getNameOverrides();
  var overrideTarget = overrides[reportName.toLowerCase().trim()];
  if (overrideTarget) {
    var match = roster.find(function(r) { return r.name.toLowerCase().trim() === overrideTarget.toLowerCase().trim(); });
    if (match) return match;
  }
  var match = roster.find(function(r) { 
      var rn = cleanStr(r.name);
      return rn === cleanReport || rn === normalizedReport;
  });
  if (match) return match;
  
  // 2. Word-based matching (LENIENT FALLBACK)
  // This allows "Carbungco, Jonathan" to match "Jonathan M. Carbungco"
  var reportWords = normalizedReport.split(" ").filter(function(w) { return w.length > 1; });
  
  match = roster.find(function(r) {
      var rosterWords = cleanStr(r.name).split(" ").filter(function(w) { return w.length > 1; });
      if (rosterWords.length < 2 || reportWords.length < 2) return false;

      // Check if all essential words from the report (shorter name) are in the roster (full name)
      // OR if all roster words are in the report.
      var allReportInRoster = reportWords.every(function(rw) { return rosterWords.indexOf(rw) > -1; });
      var allRosterInReport = rosterWords.every(function(rw) { return reportWords.indexOf(rw) > -1; });

      if (allReportInRoster || allRosterInReport) return true;
      
      // Fallback for Last Name + First Name First Word match
      if (rosterWords[0] === reportWords[0] && 
          rosterWords[rosterWords.length - 1] === reportWords[reportWords.length - 1]) {
          return true;
      }
      return false;
  });
  
  return match || null;
}

/**
 * Cleanup function to remove mistakenly imported "Block Summary Import" records.
 */
function cleanupBulkImports() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Attendance");
    if (!sheet) return "Error: 'Attendance' sheet not found in the spreadsheet.";
    
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return "Info: No attendance data found to clean.";
    
    var headers = data[0];
    var topicIdx = -1;
    // Flexible header detection
    for (var h = 0; h < headers.length; h++) {
        var hName = String(headers[h]).toLowerCase().trim();
        if (hName === "topic" || hName === "conference topic" || hName === "subject") {
            topicIdx = h;
            break;
        }
    }
    
    if (topicIdx === -1) {
        return "Error: Could not find Topic column. Found: " + headers.join(", ");
    }
    
    var rowsDeleted = 0;
    // Iterate backwards to safely delete rows
    for (var i = data.length - 1; i >= 1; i--) {
        var topic = String(data[i][topicIdx] || "").toLowerCase().trim();
        // Catch any variation of Summary Import
        if (topic.includes("summary import") || topic === "block summary import") {
            sheet.deleteRow(i + 1);
            rowsDeleted++;
        }
    }
    
    if (rowsDeleted === 0) {
        return "Info: Scanned " + (data.length-1) + " rows, but found no matches for 'Summary Import'.";
    }
    
    SpreadsheetApp.flush();
    return "\u2705 Success! Removed " + rowsDeleted + " summary records.";
  } catch (e) {
    return "Cleanup Error: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Emails a CSV string as an attachment instead of downloading it client-side.
 * This bypasses device restrictions on downloading files.
 */
function emailCSVReport(csvString, filename) {
  try {
    var emailAddress = Session.getActiveUser().getEmail();
    if (!emailAddress) return "Error: Could not determine your email address.";

    var blob = Utilities.newBlob(csvString, "text/csv", filename);
    
    MailApp.sendEmail({
      to: emailAddress,
      subject: "FMC Admin Console Export: " + filename,
      body: "Attached is the requested CSV export (" + filename + ") from the FMC Admin Console.",
      attachments: [blob]
    });
    
    return "\u2705 Success! Sent " + filename + " to " + emailAddress;
  } catch (e) {
    return "Error emailing CSV: " + e.toString();
  }
}

/**
 * --- QUESTION OF THE DAY ---
 */

function getQuestionOfTheDay() {
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  // 1. Check Cache First (High Speed Path)
  try {
    var cachedDate = props.getProperty("QOTD_CACHE_DATE");
    var cachedData = props.getProperty("QOTD_CACHE_JSON");
    if (cachedDate === today && cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (e) {
    Logger.log("Cache read error: " + e.toString());
  }

  // 2. Cache Miss or New Day: Expensive Rebuild (Run once per day program-wide)
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var masterSheet = ss.getSheetByName("Quiz_Master_List");
    if (!masterSheet || masterSheet.getLastRow() < 2) return null;
    
    var masterData = masterSheet.getDataRange().getValues();
    var allQuestions = [];
    
    for (var i = 1; i < masterData.length; i++) {
      var tab = ss.getSheetByName(masterData[i][3]);
      if (tab) {
        var qData = tab.getDataRange().getValues();
        for (var j = 1; j < qData.length; j++) {
          var qRow = qData[j];
          if (!qRow[1] && !qRow[2]) continue; // Support both 10 and 13 col
          
          var isNewLayout = !isNaN(Number(qRow[3])) && String(qRow[3]).trim() !== "";
          var qText = isNewLayout ? qRow[2] : qRow[1];
          if (!qText) continue;

          var options = isNewLayout ? 
            [qRow[6], qRow[7], qRow[8], qRow[9], qRow[10]].filter(o => o) :
            [qRow[5], qRow[6], qRow[7], qRow[8], qRow[9]].filter(o => o);

          allQuestions.push({ 
            category: (isNewLayout ? qRow[1] : qRow[0]) || "General", 
            question: qText, 
            correct: isNewLayout ? Number(qRow[3]) : Number(qRow[2]), 
            explanation: isNewLayout ? qRow[4] : qRow[3], 
            resource: isNewLayout ? qRow[5] : qRow[4], 
            options: options,
            qotdId: "qotd_" + i + "_" + j
          });
        }
      }
    }
    
    if (allQuestions.length === 0) return null;
    
    // Sort predictably
    allQuestions.sort((a, b) => (a.category + a.question).localeCompare(b.category + b.question));

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    
    try {
        var currentIndex = parseInt(props.getProperty("QOTD_INDEX")) || 0;
        var lastDate = props.getProperty("QOTD_LAST_DATE");
        
        if (lastDate !== today) {
            currentIndex++;
            props.setProperty("QOTD_LAST_DATE", today);
            props.setProperty("QOTD_INDEX", currentIndex.toString());
        }
        
        var qotd = allQuestions[currentIndex % allQuestions.length];
        
        // Update Cache
        props.setProperty("QOTD_CACHE_DATE", today);
        props.setProperty("QOTD_CACHE_JSON", JSON.stringify(qotd));
        
        return qotd;
    } finally {
        lock.releaseLock();
    }
  } catch (e) {
    Logger.log("getQuestionOfTheDay Error: " + e.toString());
    return null;
  }
}

function saveQotdToSheet(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    var ss = SpreadsheetApp.openById(SHEET_ID);
    
    var sheet = ss.getSheetByName("QOTD_Results");
    if (!sheet) {
      sheet = ss.insertSheet("QOTD_Results");
      sheet.appendRow(["Timestamp", "Date", "Email", "Name", "Question", "Category", "Correct", "IsFirstToday"]);
      sheet.setFrozenRows(1);
    }
    
    var now = new Date();
    var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "MM/dd/yyyy");
    
    // Check if they are the first today
    var lastRow = sheet.getLastRow();
    var isFirstToday = true;
    
    if (lastRow > 1) {
      var recentDates = sheet.getRange(Math.max(2, lastRow - 50), 2, Math.min(lastRow - 1, 50)).getValues();
      for (var i = recentDates.length - 1; i >= 0; i--) {
        if (String(recentDates[i][0]) === dateStr) {
          isFirstToday = false;
          break;
        }
      }
    }
    
    sheet.appendRow([
      now,
      dateStr,
      String(data.email).toLowerCase().trim(),
      data.name,
      data.question,
      data.category || "",
      data.correct ? "TRUE" : "FALSE",
      isFirstToday ? "TRUE" : "FALSE"
    ]);
    
    SpreadsheetApp.flush();
    
    // Calculate community stats for today's QOTD
    lastRow = sheet.getLastRow();
    var communityTotal = 0;
    var communityCorrect = 0;
    if (lastRow > 1) {
        // Read recent rows (safe margin of 200 rows for 1 day)
        var recentData = sheet.getRange(Math.max(2, lastRow - 200), 2, Math.min(lastRow - 1, 200), 6).getValues();
        for (var i = 0; i < recentData.length; i++) {
            if (String(recentData[i][0]) === dateStr) {
                communityTotal++;
                if (String(recentData[i][5]).toUpperCase() === "TRUE") {
                    communityCorrect++;
                }
            }
        }
    }
    
    return { success: true, isFirstToday: isFirstToday, communityTotal: communityTotal, communityCorrect: communityCorrect };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getQotdProfile(email) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("QOTD_Results");
    if (!sheet || sheet.getLastRow() < 2) return { completedToday: false, count: 0, correct: 0, streak: 0, earlyBirds: 0 };
    
    var data = sheet.getDataRange().getValues();
    var targetEmail = String(email).toLowerCase().trim();
    
    var completedToday = false;
    var count = 0;
    var correct = 0;
    var earlyBirds = 0;
    
    var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy");
    var datesDone = []; // Keep track of unique dates answered
    
    var results = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][2]).toLowerCase().trim() === targetEmail) {
        results.push({
          date: data[i][1],
          correct: String(data[i][6]).toUpperCase() === "TRUE",
          first: String(data[i][7]).toUpperCase() === "TRUE"
        });
      }
    }
    
    for (var j = 0; j < results.length; j++) {
      var row = results[j];
      count++;
      if (row.correct) correct++;
      if (row.first) earlyBirds++;
      
      var dateStr = "";
      if (row.date instanceof Date) {
          dateStr = Utilities.formatDate(row.date, Session.getScriptTimeZone(), "MM/dd/yyyy");
      } else {
          dateStr = String(row.date);
      }
      
      if (dateStr === todayStr) completedToday = true;
      if (datesDone.indexOf(dateStr) === -1) datesDone.push(dateStr);
    }
    
    // Calculate simple consecutive day streak from datesDone
    var streak = 0;
    var checkDate = new Date();
    // If they haven't completed today, start checking from yesterday
    if (!completedToday) {
        checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (true) {
        var checkStr = Utilities.formatDate(checkDate, Session.getScriptTimeZone(), "MM/dd/yyyy");
        if (datesDone.indexOf(checkStr) > -1) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    return {
      completedToday: completedToday,
      count: count,
      correct: correct,
      streak: streak,
      earlyBirds: earlyBirds,
      percentage: count > 0 ? Math.round((correct / count) * 100) : 0
    };
  } catch (e) {
    Logger.log("getQotdProfile Error: " + e.toString());
    return { completedToday: false, count: 0, correct: 0, streak: 0, earlyBirds: 0 };
  }
}

// Read-only: Fetch today's QOTD community stats without saving
function getQotdCommunityStats() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("QOTD_Results");
    if (!sheet || sheet.getLastRow() < 2) return { communityTotal: 0, communityCorrect: 0 };
    
    var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy");
    var lastRow = sheet.getLastRow();
    var communityTotal = 0;
    var communityCorrect = 0;
    
    // Only scan the last 200 rows for efficiency
    var recentData = sheet.getRange(Math.max(2, lastRow - 200), 2, Math.min(lastRow - 1, 200), 6).getValues();
    for (var i = 0; i < recentData.length; i++) {
      if (String(recentData[i][0]) === dateStr) {
        communityTotal++;
        if (String(recentData[i][5]).toUpperCase() === "TRUE") communityCorrect++;
      }
    }
    return { communityTotal: communityTotal, communityCorrect: communityCorrect };
  } catch (e) {
    return { communityTotal: 0, communityCorrect: 0 };
  }
}

// --- AUTOMATED MID-BLOCK REMINDERS ---
function setupMidBlockTrigger() {
  // Clear existing to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendMidBlockReminders") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Set to run every day at 8 AM
  ScriptApp.newTrigger("sendMidBlockReminders")
           .timeBased()
           .atHour(8)
           .everyDays(1)
           .create();
           
  return "Mid-Block reminder trigger successfully created. It will run daily at 8 AM.";
}

function sendMidBlockReminders() {
    try {
        var ss = SpreadsheetApp.openById(SHEET_ID);
        var blockSheet = ss.getSheetByName("Block_Schedule");
        if (!blockSheet || blockSheet.getLastRow() < 2) return;
        
        var blocks = blockSheet.getDataRange().getValues();
        var today = new Date();
        today.setHours(0,0,0,0);
        
        var activeBlock = null;
        for (var i = 1; i < blocks.length; i++) {
            var title = blocks[i][0];
            var start = new Date(blocks[i][1]);
            var end = new Date(blocks[i][2]);
            if (!title || isNaN(start.getTime()) || isNaN(end.getTime())) continue;
            
            // Calculate midpoint
            var midTime = start.getTime() + (end.getTime() - start.getTime()) / 2;
            var midDate = new Date(midTime);
            midDate.setHours(0,0,0,0);
            
            // If today is exactly the midpoint date
            if (today.getTime() === midDate.getTime()) {
                activeBlock = String(title).trim();
                break;
            }
        }
        
        if (!activeBlock) return; // No block is at its midpoint today
        
        // Find who hasn't completed it
        var rosterSheet = ss.getSheetByName("Roster");
        if (!rosterSheet || rosterSheet.getLastRow() < 2) return;
        var roster = rosterSheet.getDataRange().getValues();
        
        var resultsSheet = ss.getSheetByName("Results");
        var completedEmails = {};
        if (resultsSheet && resultsSheet.getLastRow() > 1) {
            var results = resultsSheet.getDataRange().getValues();
            var emailIdx = results[0].findIndex(function(h) { return String(h).toLowerCase().trim() === "email"; });
            var topicIdx = results[0].findIndex(function(h) { return String(h).toLowerCase().trim() === "topic"; });
            
            if (emailIdx > -1 && topicIdx > -1) {
                for (var j = 1; j < results.length; j++) {
                    if (String(results[j][topicIdx]).toLowerCase().trim() === activeBlock.toLowerCase()) {
                        completedEmails[String(results[j][emailIdx]).toLowerCase().trim()] = true;
                    }
                }
            }
        }
        
        // Send emails
        var emailsSent = 0;
        for (var k = 1; k < roster.length; k++) {
            var email = String(roster[k][2]).toLowerCase().trim();
            if (!email || completedEmails[email] === true) continue; // skip completed or invalid
            
            var name = roster[k][0];
            var subject = "Mid-Block Reminder: " + activeBlock;
            var htmlBody = "<div style='font-family: Arial, sans-serif; color: #333;'>";
            htmlBody += "<h2 style='color: #2563eb;'>Board Review Reminder</h2>";
            htmlBody += "<p>Hi " + name + ",</p>";
            htmlBody += "<p>This is an automated reminder that we are halfway through <strong>" + activeBlock + "</strong> and you have not yet completed the required board review questions.</p>";
            htmlBody += "<p>Please log in to the FMC Board Question App to complete your block.</p>";
            htmlBody += "<br><p>Thank you,<br>Ascension St. Vincent's Family Medicine Residency Program Jacksonville</p></div>";
            
            MailApp.sendEmail({ to: email, subject: subject, htmlBody: htmlBody });
            emailsSent++;
        }
        Logger.log("Sent " + emailsSent + " mid-block reminders for " + activeBlock);
    } catch (e) {
        Logger.log("Mid-Block Reminder Error: " + e.toString());
    }
}

// =============================================================================
// QUESTION METADATA MANAGER
// Composite key: {Year}-{ITE Q#} (e.g. "2025-015")
// Column layout: A=Year, B=System, C=Question, D=CorrectIdx, E=Explanation,
//                F=Resource, G-K=Options A-E, L=Difficulty, M=ABFM Category,
//                N=ITE Question # (the raw 3-digit zero-padded number from the exam)
// =============================================================================

/**
 * Returns the list of quiz tab names from Quiz_Master_List (i.e. actual question bank tabs).
 */
function _getQuizTabNames_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var master = ss.getSheetByName("Quiz_Master_List");
  if (!master || master.getLastRow() < 2) return [];
  var data = master.getDataRange().getValues();
  var names = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][3]) names.push(String(data[i][3]).trim());
  }
  return names;
}

/**
 * Zero-pads a number to 3 digits (e.g. 15 -> "015").
 */
function _padQid_(val) {
  var n = parseInt(String(val).trim(), 10);
  if (isNaN(n)) return String(val).trim();
  return n < 10 ? "00" + n : n < 100 ? "0" + n : String(n);
}

/**
 * Builds a composite ID string from year and qid values.
 * e.g. year="2025", qid="15" -> "2025-015"
 */
function _compositeId_(year, qid) {
  var y = String(year || "").trim();
  var q = _padQid_(qid);
  if (!y || !qid) return null;
  return y + "-" + q;
}

/**
 * validateQuestionIds()
 * Scans all question bank tabs and reports:
 *   - Total questions found
 *   - Rows missing a Year (col A)
 *   - Rows missing an ITE Q# (col N)
 *   - Duplicate composite keys within or across tabs
 * Returns a JSON string: { total, missingYear, missingQid, duplicates: [{compositeId, tabs}] }
 */
function validateQuestionIds() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var tabNames = _getQuizTabNames_();
    var seenIds = {}; // compositeId -> [{tabName, row}]
    var total = 0, missingYear = 0, missingQid = 0;

    for (var t = 0; t < tabNames.length; t++) {
      var tab = ss.getSheetByName(tabNames[t]);
      if (!tab || tab.getLastRow() < 2) continue;
      var data = tab.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        if (!row[2]) continue; // skip blank question rows
        total++;
        var year = String(row[0] || "").trim();
        var qid  = String(row[13] || "").trim(); // col N (index 13)
        if (!year) missingYear++;
        if (!qid)  missingQid++;
        if (year && qid) {
          var cid = _compositeId_(year, qid);
          if (!seenIds[cid]) seenIds[cid] = [];
          seenIds[cid].push({ tab: tabNames[t], row: r + 1 });
        }
      }
    }

    var duplicates = [];
    for (var cid in seenIds) {
      if (seenIds[cid].length > 1) duplicates.push({ compositeId: cid, locations: seenIds[cid] });
    }

    return JSON.stringify({
      success: true,
      tabsScanned: tabNames.length,
      total: total,
      missingYear: missingYear,
      missingQid: missingQid,
      duplicateCount: duplicates.length,
      duplicates: duplicates.slice(0, 20) // cap at 20 for display
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.toString() });
  }
}

/**
 * getQuestionBankExport()
 * Returns all questions from all quiz tabs as a CSV string with columns:
 * Composite ID, Year, ITE Q#, Question Text, Current Difficulty, Current ABFM Category
 * Rows missing Year or QID get a "MISSING-{tab}-R{row}" composite ID.
 */
function getQuestionBankExport() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var tabNames = _getQuizTabNames_();
    var rows = [["Composite ID", "Year", "ITE Q#", "Question Text", "Current Difficulty", "Current ABFM Content Area"]];

    for (var t = 0; t < tabNames.length; t++) {
      var tab = ss.getSheetByName(tabNames[t]);
      if (!tab || tab.getLastRow() < 2) continue;
      var data = tab.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        if (!row[2]) continue;
        var year = String(row[0] || "").trim();
        var qid  = String(row[13] || "").trim();
        var compositeId = (year && qid) ? _compositeId_(year, qid) : ("MISSING-" + tabNames[t] + "-R" + (r + 1));
        var questionText = String(row[2] || "").replace(/"/g, '""').replace(/\n/g, " ");
        var difficulty   = String(row[11] || "").trim();
        var abfmCat      = String(row[12] || "").trim();
        rows.push([compositeId, year, qid, '"' + questionText + '"', difficulty, abfmCat]);
      }
    }

    var csv = rows.map(function(r) { return r.join(","); }).join("\n");
    return JSON.stringify({ success: true, csv: csv, count: rows.length - 1 });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.toString() });
  }
}

/**
 * bulkUpdateQuestionMetadata(csvJson)
 * Accepts a JSON string: an array of { compositeId, difficulty, abfmCategory }
 * Finds each question by its composite Year+QID, then writes ONLY to col L and col M.
 * overwriteExisting: if false (safe mode), skips rows that already have values in L or M.
 * Returns: { updated, notFound, skipped, duplicateWarnings }
 */
function bulkUpdateQuestionMetadata(csvJson) {
  try {
    var payload = JSON.parse(csvJson);
    var records = payload.records;       // array of {compositeId, difficulty, abfmCategory}
    var overwrite = payload.overwrite === true;

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var tabNames = _getQuizTabNames_();

    // Build an index: compositeId -> [{tab, rowIndex}]
    var index = {};
    for (var t = 0; t < tabNames.length; t++) {
      var tab = ss.getSheetByName(tabNames[t]);
      if (!tab || tab.getLastRow() < 2) continue;
      var data = tab.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        if (!row[2]) continue;
        var year = String(row[0] || "").trim();
        var qid  = String(row[13] || "").trim();
        if (!year || !qid) continue;
        var cid = _compositeId_(year, qid);
        if (!index[cid]) index[cid] = [];
        index[cid].push({ tabName: tabNames[t], rowIndex: r + 1 }); // 1-based sheet row
      }
    }

    var updated = 0, notFound = 0, skipped = 0, duplicateWarnings = 0;

    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var cid = String(rec.compositeId || "").trim();
      if (!cid) continue;

      var matches = index[cid];
      if (!matches || matches.length === 0) {
        notFound++;
        continue;
      }
      if (matches.length > 1) duplicateWarnings++;

      // Update first match (warn if duplicates exist)
      var match = matches[0];
      var targetTab = ss.getSheetByName(match.tabName);
      var existingDiff = String(targetTab.getRange(match.rowIndex, 12).getValue() || "").trim(); // col L
      var existingCat  = String(targetTab.getRange(match.rowIndex, 13).getValue() || "").trim(); // col M

      if (!overwrite && (existingDiff || existingCat)) {
        skipped++;
        continue;
      }

      if (rec.difficulty)   targetTab.getRange(match.rowIndex, 12).setValue(rec.difficulty);
      if (rec.abfmCategory) targetTab.getRange(match.rowIndex, 13).setValue(rec.abfmCategory);
      updated++;
    }

    return JSON.stringify({ success: true, updated: updated, notFound: notFound, skipped: skipped, duplicateWarnings: duplicateWarnings });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.toString() });
  }
}