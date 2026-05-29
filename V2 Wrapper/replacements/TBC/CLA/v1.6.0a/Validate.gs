function populateValidate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = SpreadsheetApp.getActiveSheet();
  var instructionsSheet = ss.getSheetByName("Instructions");
  var confSpreadSheet = SpreadsheetApp.openById('1pIbbPkn9i5jxyQ60Xt86fLthtbdCAmFriIpPSvmXiu0');

  try { var lang = shiftRangeByColumns(instructionsSheet, instructionsSheet.createTextFinder("^1.$").useRegularExpression(true).findNext(), 4).getValue(); } catch { }
  var langSheet = confSpreadSheet.getSheetByName("langTexts");
  var offset;
  if (lang != null && lang == "English") {
    lang = "EN";
    offset = 1;
  } else if (lang != null && lang == "Deutsch") {
    lang = "DE";
    offset = 2;
  } else if (lang != null && lang == "简体中文") {
    lang = "CN";
    offset = 3;
  } else if (lang != null && lang == "русский") {
    lang = "RU";
    offset = 4;
  } else if (lang != null && lang == "français") {
    lang = "FR";
    offset = 5;
  } else {
    lang = "EN";
    offset = 1;
  }
  var langKeys = langSheet.getRange(1, 1, 1000, 1).getValues().reduce(function (ar, e) { ar.push(e[0]); return ar; }, []);
  var langTrans = langSheet.getRange(1, 1 + offset, 1000, 1).getValues().reduce(function (ar, e) { ar.push(e[0]); return ar; }, []);

  instructionsSheet.getRange(26, 2).setValue("");
  instructionsSheet.getRange(27, 2).setValue("");

  var darkMode = false;
  try {
    if (shiftRangeByRows(instructionsSheet, shiftRangeByColumns(instructionsSheet, instructionsSheet.createTextFinder("^" + getStringForLang("email", langKeys, langTrans, "", "", "", "") + "$").useRegularExpression(true).findNext(), -1), 4).getValue().indexOf("yes") > -1)
      darkMode = true;
  } catch { }

  sheet.getRange(6, 5, 29, 1).clearContent();
  sheet.getRange(8, 10, 7, 2).clearContent();
  sheet.getRange(10, 9, 1, 2).clearContent();
  sheet.getRange(10, 8, 1, 2).copyTo(sheet.getRange(10, 9, 1, 2), SpreadsheetApp.CopyPasteType.PASTE_CONDITIONAL_FORMATTING, false);
  sheet.getRange(12, 9, 1, 2).clearContent();
  sheet.getRange(12, 8, 1, 2).clearContent();
  if (darkMode) {
    sheet.getRange(1, 1, 34, 11).setBackground("#d9d9d9");
    sheet.getRange(1, 1, 34, 2).setFontColor("#d9d9d9");
    sheet.getRange(1, 7, 34, 1).setFontColor("#d9d9d9");
    sheet.getRange(1, 11, 34, 1).setFontColor("#d9d9d9");
    sheet.getRange(2, 10, 1, 1).setFontColor("#d9d9d9");
  } else {
    sheet.getRange(1, 1, 34, 11).setBackground("white");
    sheet.getRange(1, 1, 34, 2).setFontColor("white");
    sheet.getRange(1, 7, 34, 1).setFontColor("white");
    sheet.getRange(1, 11, 34, 1).setFontColor("white");
    sheet.getRange(2, 10, 1, 1).setFontColor("white");
  }
  sheet.getRange(2, 4, 1, 1).setBackground("#cccccc");

  var api_key = shiftRangeByColumns(instructionsSheet, instructionsSheet.createTextFinder("^2.$").useRegularExpression(true).findNext(), 4).getValue().replace(/\s/g, "");
  var reportPathOrId = shiftRangeByColumns(instructionsSheet, instructionsSheet.createTextFinder("^3.$").useRegularExpression(true).findNext(), 4).getValue();
  var includeReportTitleInSheetNames = shiftRangeByColumns(instructionsSheet, instructionsSheet.createTextFinder("^4.$").useRegularExpression(true).findNext(), 4).getValue();
  var information = addRowsToRange(sheet, sheet.createTextFinder("^" + getStringForLang("title", langKeys, langTrans, "", "", "", "") + " $").useRegularExpression(true).findNext(), 2);
  var stringl = getStringForLang("manualOverwriteZone", langKeys, langTrans, "", "", "", "");
  var validateZone = shiftRangeByColumns(sheet, sheet.createTextFinder(getStringForLang("manualOverwriteZone", langKeys, langTrans, "", "", "", "")).useRegularExpression(false).findNext(), 1).getValue();
  var validateZoneAbr = "";
  if (validateZone.indexOf("Karazhan") > -1 || validateZone.indexOf(getStringForLang("Karazhan", langKeys, langTrans, "", "", "", "")) > - 1)
    validateZoneAbr = "Kara";
  if (validateZone.indexOf("TK") > -1 || validateZone.indexOf(getStringForLang("TK", langKeys, langTrans, "", "", "", "")) > - 1)
    validateZoneAbr = "TK";
  if (validateZone.indexOf("BT") > -1 || validateZone.indexOf(getStringForLang("BT", langKeys, langTrans, "", "", "", "")) > - 1)
    validateZoneAbr = "BT";
  if (validateZone.indexOf("Sunwell") > -1 || validateZone.indexOf(getStringForLang("Sunwell", langKeys, langTrans, "", "", "", "")) > - 1)
    validateZoneAbr = "Sunwell";
  shiftRangeByColumns(sheet, information, 1).clearContent();

  reportPathOrId = reportPathOrId.replace(".cn/", ".com/");
  var logId = "";
  if (reportPathOrId.indexOf("vanilla.warcraftlogs") > -1)
    SpreadsheetApp.getUi().alert(getStringForLang("vanillaExecution", langKeys, langTrans, "", "", "", ""));
  if (reportPathOrId.indexOf("classic.warcraftlogs.com/reports/") > -1)
    logId = reportPathOrId.split("classic.warcraftlogs.com/reports/")[1].split("#")[0].split("?")[0];
  else if (reportPathOrId.indexOf("tbc.warcraftlogs.com/reports/") > -1)
    logId = reportPathOrId.split("tbc.warcraftlogs.com/reports/")[1].split("#")[0].split("?")[0];
  else if (reportPathOrId.indexOf("fresh.warcraftlogs.com/reports/") > -1)
    logId = reportPathOrId.split("fresh.warcraftlogs.com/reports/")[1].split("#")[0].split("?")[0];
  else
    logId = reportPathOrId;
  var startEndString = "&start=0&end=999999999999";
  var apiKeyString = "?translate=true&api_key=" + api_key;
  var baseUrl = "https://classic.warcraftlogs.com:443/v1/";
  if (lang != "EN") {
    baseUrl = "https://" + lang.toLowerCase() + ".classic.warcraftlogs.com:443/v1/";
    baseUrlFrontEnd = "https://" + lang.toLowerCase() + ".classic.warcraftlogs.com/reports/";
  }

  // Wrapper Replacement for allFightsData
  var allFightsData = wclFetchFights_(api_key, logId, { lang: lang });

  var baseSheetName = getStringForLang("validateTab", langKeys, langTrans, "", "", "", "");
  if (includeReportTitleInSheetNames.indexOf("yes") > -1)
    baseSheetName += " " + allFightsData.title;
  try {
    sheet.setName(baseSheetName);
  } catch (err) {
    try {
      sheet.setName(baseSheetName + "_" + getStringForLang("new", langKeys, langTrans, "", "", "", ""));
    } catch (err2) {
      try {
        sheet.setName(baseSheetName + "_" + getStringForLang("new", langKeys, langTrans, "", "", "", "") + "_" + getStringForLang("new", langKeys, langTrans, "", "", "", ""));
      } catch (err3) {
        sheet.setName(baseSheetName + "_" + getStringForLang("new", langKeys, langTrans, "", "", "", "") + "_" + getStringForLang("new", langKeys, langTrans, "", "", "", "") + "_" + getStringForLang("new", langKeys, langTrans, "", "", "", ""));
      }
    }
  }

  var zoneId = allFightsData.zone;
  allFightsData.fights.forEach(function (fight, fightCount) {
    if (fight.zoneName != null && fight.zoneName.length > 0) {
      if (validateZoneAbr != "") {
        if (fight.zoneName.indexOf(validateZoneAbr) > -1) {
          sheet.getRange(information.getRow() + 1, information.getColumn() + 1).setValue(fight.zoneName);
          zoneId = fight.zoneID;
        }
      } else
        sheet.getRange(information.getRow() + 1, information.getColumn() + 1).setValue(fight.zoneName);
    }
  })
  if (allFightsData.zone != null && allFightsData.zone > 0 && (allFightsData.zone < 1007 || (allFightsData.zone >= 2000 && allFightsData.zone < 2007)))
    SpreadsheetApp.getUi().alert(getStringForLang("vanillaExecution", langKeys, langTrans, "", "", "", ""));
  else if (allFightsData.zone <= 0)
    SpreadsheetApp.getUi().alert(getStringForLang("zoneNotRecognized", langKeys, langTrans, "", "", "", ""));

  var returnVal = getRaidStartAndEnd(allFightsData, ss, baseUrl + "report/events/summary/" + logId + apiKeyString);
  var zonesFound = [];
  if (returnVal != null && returnVal.zonesFound != null)
    zonesFound = returnVal.zonesFound;
  var zoneTimesString = " (";
  if (zonesFound != null && zonesFound.length > 0) {
    zonesFound.forEach(function (raidZone, raidZoneCount) {
      zoneTimesString += raidZone[5] + " " + getStringForLang("in", langKeys, langTrans, "", "", "", "") + " ";
      if (raidZone[10] > 0) {
        zoneTimesString += getStringForTimeStamp(raidZone[10], true) + ", ";
      } else {
        zoneTimesString += getStringForTimeStamp(raidZone[2] - raidZone[1], true) + ", ";
      }
    })
    zoneTimesString = zoneTimesString.substr(0, zoneTimesString.length - 2);
    if (zoneTimesString.length > 0)
      sheet.getRange(information.getRow(), information.getColumn() + 1).setValue(allFightsData.title + zoneTimesString + ")");
    else
      sheet.getRange(information.getRow(), information.getColumn() + 1).setValue(allFightsData.title);

    var dateString = "";
    if (lang == "DE" || lang == "RU")
      dateString = Utilities.formatDate(new Date(allFightsData.start), "GMT+1", "dd.MM.yyyy HH:mm:ss");
    else if (lang == "EN")
      dateString = Utilities.formatDate(new Date(allFightsData.start), "GMT+1", "MMMM dd, yyyy HH:mm:ss");
    else if (lang == "CN")
      dateString = Utilities.formatDate(new Date(allFightsData.start), "GMT+1", "yyyy年M月d日 HH:mm:ss");
    else if (lang == "FR")
      dateString = Utilities.formatDate(new Date(allFightsData.start), "GMT+1", "dd/MM/yyyy HH:mm:ss");
    sheet.getRange(information.getRow() + 2, information.getColumn() + 1).setValue(dateString);

    Utilities.sleep(1500);
    var confMobsToTrack = sheet.createTextFinder("^IDs$").useRegularExpression(true).findNext();
    var mobsToTrack = addRowsToRange(sheet, shiftRangeByRows(sheet, confMobsToTrack, 1), 200).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
    var dungeonsToTrack = shiftRangeByColumns(sheet, addRowsToRange(sheet, shiftRangeByRows(sheet, confMobsToTrack, 1), 200), 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
    mobsToTrack.forEach(function (mob, mobCount) {
      var idCell = shiftRangeByRows(sheet, confMobsToTrack, 1 + mobCount);
      var dungeon = dungeonsToTrack[mobCount];
      var zoneEnd = -1;
      var zoneStart = -1;
      if (zonesFound != null && zonesFound.length > 0) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZone[5] == dungeon) {
            zoneStart = raidZone[1];
            zoneEnd = raidZone[2];
          }
        })
      }
      var amountCell = shiftRangeByColumns(sheet, idCell, 4);
      var ids = mob.toString().split(",");
      var idDeathCount = 0;
      ids.forEach(function (id, idCount) {
        allFightsData.enemies.forEach(function (enemyData, enemyDataCount) {
          if (enemyData.id != null && enemyData.id.toString().length > 0 && enemyData.guid != null && enemyData.guid.toString().length > 0 && id.toString() == enemyData.guid.toString()) {
            // Wrapper Replacement for deathsTrackedData
            var deathsTrackedData = wclFetchEvents_(api_key, logId, "deaths", {
              lang: lang,
              start: zoneStart,
              end: zoneEnd,
              hostility: 1,
              sourceid: enemyData.id
            });
            Utilities.sleep(30);
            deathsTrackedData.events.forEach(function (enemy, enemyCount) {
              idDeathCount++;
            })
          }
        })
      })
      amountCell.setValue(idDeathCount);
    })

    // Wrapper Replacement for charactersTrackedData
    var charactersTrackedData = wclFetchTable_(api_key, logId, "damage-taken", {
      lang: lang,
      start: zonesFound[0][1],
      end: zonesFound[zonesFound.length - 1][2],
      encounter: -2
    });
    var charactersTracked = 0;
    if (charactersTrackedData != null && charactersTrackedData.entries != null && charactersTrackedData.entries.length > 0) {
      charactersTrackedData.entries.forEach(function (characterTracked, characterTrackedCount) {
        if (characterTracked != null && characterTracked.type != null && characterTracked.type.toString().length > 0) {
          if (characterTracked.type.toString() != "NPC" && characterTracked.type.toString() != "Boss")
            charactersTracked += 1;
        }
      })
    }
    var charactersCell = sheet.getRange(8, 10);
    charactersCell.setValue(charactersTracked);

    var confSpreadSheet = SpreadsheetApp.openById('1pIbbPkn9i5jxyQ60Xt86fLthtbdCAmFriIpPSvmXiu0');
    var validateConfigSheetKara = confSpreadSheet.getSheetByName("validateKaraLog");
    var validateConfigSheetSSCTK = confSpreadSheet.getSheetByName("validateSSCTKLog");
    var validateConfigSheetMHBT = confSpreadSheet.getSheetByName("validateMHBTLog");
    var validateConfigSheetZA = confSpreadSheet.getSheetByName("validateZALog");
    var validateConfigSheetSW = confSpreadSheet.getSheetByName("validateSWLog");

    var karaWCLzoneID = validateConfigSheetKara.getRange(2, validateConfigSheetKara.createTextFinder("Kara WCLzoneID").useRegularExpression(true).findNext().getColumn()).getValue();
    var sscWCLzoneID = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("SSC WCLzoneID").useRegularExpression(true).findNext().getColumn()).getValue();
    var tkWCLzoneID = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("TK WCLzoneID").useRegularExpression(true).findNext().getColumn()).getValue();
    var mhWCLzoneID = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("MH WCLzoneID").useRegularExpression(true).findNext().getColumn()).getValue();
    var btWCLzoneID = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("BT WCLzoneID").useRegularExpression(true).findNext().getColumn()).getValue();
    var zaWCLzoneID = validateConfigSheetZA.getRange(2, validateConfigSheetZA.createTextFinder("ZA WCLzoneID").useRegularExpression(true).findNext().getColumn()).getValue();

    if (zoneId.toString() == karaWCLzoneID) {
      var karaBosses = validateConfigSheetKara.getRange(2, validateConfigSheetKara.createTextFinder("Kara boss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
      var killedBosses = 0;
      allFightsData.fights.forEach(function (fight, fightCount) {
        if (fight.boss != null && Number(fight.boss) > 0 && fight.kill == true && karaBosses.indexOf(fight.boss) > -1)
          killedBosses += 1;
      })
      sheet.getRange(10, 9).setFontWeight("bold").setHorizontalAlignment("right").setValue(getStringForLang("numberOfBossesKilledSingle", langKeys, langTrans, "10", "", "", ""));
      sheet.getRange(10, 10).setValue("'" + killedBosses);
      var rule = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=VALUE(' + sheet.getRange(10, 10).getA1Notation() + ')>=10')
        .setBackground("#93c47d")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rule2 = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=AND(VALUE(' + sheet.getRange(10, 10).getA1Notation() + ')>=0,VALUE(' + sheet.getRange(10, 10).getA1Notation() + ')<10)')
        .setBackground("#ea9999")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rules = sheet.getConditionalFormatRules();
      rules.push(rule2);
      rules.push(rule);
      sheet.setConditionalFormatRules(rules);

      sheet.getRange(12, 9).setFontWeight("bold").setHorizontalAlignment("right").setValue(getStringForLang("containsStartPoint", langKeys, langTrans, "", "", "", ""));

      var karaStartingPointFound = false;
      if (zonesFound != null && zonesFound.length > 0) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZone[5] == "Kara" && raidZone[6] == "true") {
            karaStartingPointFound = true;
          }
        })
      }
      if (karaStartingPointFound)
        sheet.getRange(12, 10).setValue(getStringForLang("yes", langKeys, langTrans, "", "", "", ""));
      else
        sheet.getRange(12, 10).setValue(getStringForLang("no", langKeys, langTrans, "", "", "", ""));
    } else if (zoneId.toString() == sscWCLzoneID || zoneId.toString() == tkWCLzoneID) {
      var sscBosses = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("SSC boss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
      var tkBosses = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("TK boss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
      var killedSSCBosses = 0;
      var killedTKBosses = 0;
      allFightsData.fights.forEach(function (fight, fightCount) {
        if (fight.boss != null && Number(fight.boss) > 0 && fight.kill == true) {
          if (sscBosses.indexOf(fight.boss) > -1)
            killedSSCBosses += 1;
          if (tkBosses.indexOf(fight.boss) > -1)
            killedTKBosses += 1;
        }
      })
      sheet.getRange(10, 9).setFontWeight("bold").setHorizontalAlignment("right").setValue(getStringForLang("numberOfBossesKilledDouble", langKeys, langTrans, "6", "SSC", "4", "TK"));
      sheet.getRange(10, 10).setValue("SSC: " + killedSSCBosses + " - TK: " + killedTKBosses);

      var rule = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=AND(REGEXMATCH(J10, "TK: 4"), REGEXMATCH(J10, "SSC: 6"))')
        .setBackground("#93c47d")
        .setRanges([sheet.getRange(10, 10)])
        .build();


      var rule2 = SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('SSC: 6')
        .setBackground("#fff2cc")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rule3 = SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('TK: 4')
        .setBackground("#fff2cc")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rule4 = SpreadsheetApp.newConditionalFormatRule()
        .whenCellNotEmpty()
        .setBackground("#ea9999")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rules = sheet.getConditionalFormatRules();
      rules.push(rule);
      rules.push(rule2);
      rules.push(rule3);
      rules.push(rule4);
      sheet.setConditionalFormatRules(rules);

      var stringToPrint = "SSC: ";
      sheet.getRange(12, 9).setFontWeight("bold").setHorizontalAlignment("right").setValue(getStringForLang("containsStartPoint", langKeys, langTrans, "", "", "", ""));

      var sscStartingPointFound = false;
      if (zonesFound != null && zonesFound.length > 0) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZone[5] == "SSC" && raidZone[6] == "true") {
            sscStartingPointFound = true;
          }
        })
      }
      var tkStartingPointFound = false;
      if (zonesFound != null && zonesFound.length > 0) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZone[5] == "TK" && raidZone[6] == "true") {
            tkStartingPointFound = true;
          }
        })
      }

      if (sscStartingPointFound)
        stringToPrint += getStringForLang("yes", langKeys, langTrans, "", "", "", "") + " - TK: ";
      else
        stringToPrint += getStringForLang("no", langKeys, langTrans, "", "", "", "") + " - TK: ";
      if (tkStartingPointFound)
        stringToPrint += getStringForLang("yes", langKeys, langTrans, "", "", "", "");
      else
        stringToPrint += getStringForLang("no", langKeys, langTrans, "", "", "", "");

      sheet.getRange(12, 10).setValue(stringToPrint);
    } else if (zoneId.toString() == mhWCLzoneID || zoneId.toString() == btWCLzoneID) {
      var mhBosses = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("MH boss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
      var btBosses = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("BT boss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
      var killedMHBosses = 0;
      var killedBTBosses = 0;
      allFightsData.fights.forEach(function (fight, fightCount) {
        if (fight.boss != null && Number(fight.boss) > 0 && fight.kill == true) {
          if (mhBosses.indexOf(fight.boss) > -1)
            killedMHBosses += 1;
          if (btBosses.indexOf(fight.boss) > -1)
            killedBTBosses += 1;
        }
      })
      sheet.getRange(10, 9).setFontWeight("bold").setHorizontalAlignment("right").setValue(getStringForLang("numberOfBossesKilledDouble", langKeys, langTrans, "5", "MH", "9", "BT"));
      sheet.getRange(10, 10).setValue("MH: " + killedMHBosses + " - BT: " + killedBTBosses);

      var rule = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=AND(REGEXMATCH(J10, "MH: 5"), REGEXMATCH(J10, "BT: 9"))')
        .setBackground("#93c47d")
        .setRanges([sheet.getRange(10, 10)])
        .build();


      var rule2 = SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('MH: 5')
        .setBackground("#fff2cc")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rule3 = SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('BT: 9')
        .setBackground("#fff2cc")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rule4 = SpreadsheetApp.newConditionalFormatRule()
        .whenCellNotEmpty()
        .setBackground("#ea9999")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rules = sheet.getConditionalFormatRules();
      rules.push(rule);
      rules.push(rule2);
      rules.push(rule3);
      rules.push(rule4);
      sheet.setConditionalFormatRules(rules);

      var stringToPrint = "MH: ";
      sheet.getRange(12, 9).setFontWeight("bold").setHorizontalAlignment("right").setValue(getStringForLang("containsStartPoint", langKeys, langTrans, "", "", "", ""));

      var mhStartingPointFound = false;
      if (zonesFound != null && zonesFound.length > 0) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZone[5] == "MH" && raidZone[6] == "true") {
            mhStartingPointFound = true;
          }
        })
      }
      var btStartingPointFound = false;
      if (zonesFound != null && zonesFound.length > 0) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZone[5] == "BT" && raidZone[6] == "true") {
            btStartingPointFound = true;
          }
        })
      }

      if (mhStartingPointFound)
        stringToPrint += getStringForLang("yes", langKeys, langTrans, "", "", "", "") + " - BT: ";
      else
        stringToPrint += getStringForLang("no", langKeys, langTrans, "", "", "", "") + " - BT: ";
      if (btStartingPointFound)
        stringToPrint += getStringForLang("yes", langKeys, langTrans, "", "", "", "");
      else
        stringToPrint += getStringForLang("no", langKeys, langTrans, "", "", "", "");

      sheet.getRange(12, 10).setValue(stringToPrint);
    } else if (zoneId.toString() == zaWCLzoneID) {
      var zaBosses = validateConfigSheetZA.getRange(2, validateConfigSheetZA.createTextFinder("ZA boss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
      var killedBosses = 0;
      allFightsData.fights.forEach(function (fight, fightCount) {
        if (fight.boss != null && Number(fight.boss) > 0 && fight.kill == true && zaBosses.indexOf(fight.boss) > -1)
          killedBosses += 1;
      })
      sheet.getRange(10, 9).setFontWeight("bold").setHorizontalAlignment("right").setValue(getStringForLang("numberOfBossesKilledSingle", langKeys, langTrans, "6", "", "", ""));
      sheet.getRange(10, 10).setValue("'" + killedBosses);
      var rule = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=VALUE(' + sheet.getRange(10, 10).getA1Notation() + ')>=6')
        .setBackground("#93c47d")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rule2 = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=AND(VALUE(' + sheet.getRange(10, 10).getA1Notation() + ')>=0,VALUE(' + sheet.getRange(10, 10).getA1Notation() + ')<6)')
        .setBackground("#ea9999")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rules = sheet.getConditionalFormatRules();
      rules.push(rule2);
      rules.push(rule);
      sheet.setConditionalFormatRules(rules);

      sheet.getRange(12, 9).setFontWeight("bold").setHorizontalAlignment("right").setValue(getStringForLang("containsStartPoint", langKeys, langTrans, "", "", "", ""));

      var zaStartingPointFound = false;
      if (zonesFound != null && zonesFound.length > 0) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZone[5] == "ZA" && raidZone[6] == "true") {
            zaStartingPointFound = true;
          }
        })
      }
      if (zaStartingPointFound)
        sheet.getRange(12, 10).setValue(getStringForLang("yes", langKeys, langTrans, "", "", "", ""));
      else
        sheet.getRange(12, 10).setValue(getStringForLang("no", langKeys, langTrans, "", "", "", ""));
    } else if (zoneId.toString() == sscWCLzoneID) {
      var swBosses = validateConfigSheetSW.getRange(2, validateConfigSheetSW.createTextFinder("SW boss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
      var killedBosses = 0;
      allFightsData.fights.forEach(function (fight, fightCount) {
        if (fight.boss != null && Number(fight.boss) > 0 && fight.kill == true && swBosses.indexOf(fight.boss) > -1)
          killedBosses += 1;
      })
      sheet.getRange(10, 9).setFontWeight("bold").setHorizontalAlignment("right").setValue(getStringForLang("numberOfBossesKilledSingle", langKeys, langTrans, "6", "", "", ""));
      sheet.getRange(10, 10).setValue("'" + killedBosses);
      var rule = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=VALUE(' + sheet.getRange(10, 10).getA1Notation() + ')>=6')
        .setBackground("#93c47d")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rule2 = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=AND(VALUE(' + sheet.getRange(10, 10).getA1Notation() + ')>=0,VALUE(' + sheet.getRange(10, 10).getA1Notation() + ')<6)')
        .setBackground("#ea9999")
        .setRanges([sheet.getRange(10, 10)])
        .build();

      var rules = sheet.getConditionalFormatRules();
      rules.push(rule2);
      rules.push(rule);
      sheet.setConditionalFormatRules(rules);

      sheet.getRange(12, 9).setFontWeight("bold").setHorizontalAlignment("right").setValue(getStringForLang("containsStartPoint", langKeys, langTrans, "", "", "", ""));

      var swStartingPointFound = false;
      if (zonesFound != null && zonesFound.length > 0) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZone[5] == "SW" && raidZone[6] == "true") {
            swStartingPointFound = true;
          }
        })
      }
      if (swStartingPointFound)
        sheet.getRange(12, 10).setValue(getStringForLang("yes", langKeys, langTrans, "", "", "", ""));
      else
        sheet.getRange(12, 10).setValue(getStringForLang("no", langKeys, langTrans, "", "", "", ""));
    }
  } else
    SpreadsheetApp.getUi().alert(getStringForLang("noRaidZone", langKeys, langTrans, "", "", "", ""));
}

function getRaidStartAndEnd(allFightsData, ss, queryEnemy) {
  var confSpreadSheet = SpreadsheetApp.openById('1pIbbPkn9i5jxyQ60Xt86fLthtbdCAmFriIpPSvmXiu0');
  var validateConfigSheetKara = confSpreadSheet.getSheetByName("validateKaraLog");
  var validateConfigSheetSSCTK = confSpreadSheet.getSheetByName("validateSSCTKLog");
  var validateConfigSheetMHBT = confSpreadSheet.getSheetByName("validateMHBTLog");
  var validateConfigSheetZA = confSpreadSheet.getSheetByName("validateZALog");
  var validateConfigSheetSW = confSpreadSheet.getSheetByName("validateSWLog");
  var otherSheet = confSpreadSheet.getSheetByName("other");

  var queryEnemyFilled = false;
  if (queryEnemy != null && queryEnemy.length > 0) {
    queryEnemy = queryEnemy + "&hostility=1&sourceid=";
    queryEnemyFilled = true;
  }

  var zonesFound = [];

  var validZones = [];
  validZones.push(532); validZones.push(249); validZones.push(309); validZones.push(409); validZones.push(469); validZones.push(509); validZones.push(531); validZones.push(544); validZones.push(548); validZones.push(550); validZones.push(564); validZones.push(565); validZones.push(568); validZones.push(580); validZones.push(534); validZones.push(533);

  var karaZoneID = validateConfigSheetKara.getRange(2, validateConfigSheetKara.createTextFinder("Kara zoneID").useRegularExpression(true).findNext().getColumn()).getValue();
  var karaStartPoint = validateConfigSheetKara.getRange(2, validateConfigSheetKara.createTextFinder("Kara start point").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var karaEndbosses = validateConfigSheetKara.getRange(2, validateConfigSheetKara.createTextFinder("Kara endboss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var karaMobs = validateConfigSheetKara.getRange(2, validateConfigSheetKara.createTextFinder("Kara mobs").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var sscZoneID = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("SSC zoneID").useRegularExpression(true).findNext().getColumn()).getValue();
  var sscStartPoint = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("SSC start point").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var sscEndbosses = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("SSC endboss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var sscMobs = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("SSC mobs").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var tkZoneID = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("TK zoneID").useRegularExpression(true).findNext().getColumn()).getValue();
  var tkStartPoint = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("TK start point").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var tkEndbosses = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("TK endboss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var tkMobs = validateConfigSheetSSCTK.getRange(2, validateConfigSheetSSCTK.createTextFinder("TK mobs").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var mhZoneID = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("MH zoneID").useRegularExpression(true).findNext().getColumn()).getValue();
  var mhStartPoint = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("MH start point").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var mhEndbosses = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("MH endboss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var mhMobs = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("MH mobs").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var btZoneID = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("BT zoneID").useRegularExpression(true).findNext().getColumn()).getValue();
  var btStartPoint = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("BT start point").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var btEndbosses = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("BT endboss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var btMobs = validateConfigSheetMHBT.getRange(2, validateConfigSheetMHBT.createTextFinder("BT mobs").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var zaZoneID = validateConfigSheetZA.getRange(2, validateConfigSheetZA.createTextFinder("ZA zoneID").useRegularExpression(true).findNext().getColumn()).getValue();
  var zaStartPoint = validateConfigSheetZA.getRange(2, validateConfigSheetZA.createTextFinder("ZA start point").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var zaEndbosses = validateConfigSheetZA.getRange(2, validateConfigSheetZA.createTextFinder("ZA endboss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var zaMobs = validateConfigSheetZA.getRange(2, validateConfigSheetZA.createTextFinder("ZA mobs").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var swZoneID = validateConfigSheetSW.getRange(2, validateConfigSheetSW.createTextFinder("SW zoneID").useRegularExpression(true).findNext().getColumn()).getValue();
  var swStartPoint = validateConfigSheetSW.getRange(2, validateConfigSheetSW.createTextFinder("SW start point").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var swEndbosses = validateConfigSheetSW.getRange(2, validateConfigSheetSW.createTextFinder("SW endboss").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);
  var swMobs = validateConfigSheetSW.getRange(2, validateConfigSheetSW.createTextFinder("SW mobs").useRegularExpression(true).findNext().getColumn(), 2000, 1).getValues().reduce(function (ar, e) { if (e[0]) ar.push(e[0]); return ar; }, []);

  var maxMillisecondsInfight = Number(otherSheet.getRange(1, 1).getValue());

  var atLeastOneStartPointFoundAfterXSecondsInfight = false;

  allFightsData.fights.forEach(function (fight, fightCount) {
    var raidZoneFound = -1;
    var zoneStart = -1;
    var zoneEnd = -1;
    var zoneStartRaw = -1;
    var zoneEndRaw = -1;
    zonesFound.forEach(function (raidZone, raidZoneCount) {
      if (fight.zoneID == raidZone[0]) {
        raidZoneFound = fight.zoneID;
        zoneStart = raidZone[1];
        zoneEnd = raidZone[2];
        zoneStartRaw = raidZone[3];
        zoneEndRaw = raidZone[4];
      }
    })
    if (raidZoneFound == -1) {
      zonesFound.forEach(function (raidZone, raidZoneCount) {
        allFightsData.enemies.forEach(function (enemy, enemyCount) {
          enemy.fights.forEach(function (enemyFight, enemyFightCount) {
            if (fight.id == enemyFight.id && (karaMobs.indexOf(enemy.guid) > -1 || sscMobs.indexOf(enemy.guid) > -1 || tkMobs.indexOf(enemy.guid) > -1 || mhMobs.indexOf(enemy.guid) > -1 || btMobs.indexOf(enemy.guid) > -1 || zaMobs.indexOf(enemy.guid) > -1 || swMobs.indexOf(enemy.guid) > -1)) {
              if ((karaMobs.indexOf(enemy.guid) > -1 && karaZoneID == raidZone[0]) || (sscMobs.indexOf(enemy.guid) > -1 && sscZoneID == raidZone[0]) || (tkMobs.indexOf(enemy.guid) > -1 && tkZoneID == raidZone[0]) || (mhMobs.indexOf(enemy.guid) > -1 && mhZoneID == raidZone[0]) || (btMobs.indexOf(enemy.guid) > -1 && btZoneID == raidZone[0]) || (zaMobs.indexOf(enemy.guid) > -1 && zaZoneID == raidZone[0]) || (swMobs.indexOf(enemy.guid) > -1 && swZoneID == raidZone[0])) {
                raidZoneFound = raidZone[0];
                zoneStart = raidZone[1];
                zoneEnd = raidZone[2];
                zoneStartRaw = raidZone[3];
                zoneEndRaw = raidZone[4];
              }
            }
          })
        })
      })
    }
    if (raidZoneFound == -1) {
      if (validZones.indexOf(fight.zoneID) > -1)
        raidZoneFound = fight.zoneID;
      else {
        allFightsData.enemies.forEach(function (enemy, enemyCount) {
          enemy.fights.forEach(function (enemyFight, enemyFightCount) {
            if (raidZoneFound == -1 && fight.id == enemyFight.id && (karaMobs.indexOf(enemy.guid) > -1 || sscMobs.indexOf(enemy.guid) > -1 || tkMobs.indexOf(enemy.guid) > -1 || mhMobs.indexOf(enemy.guid) > -1 || btMobs.indexOf(enemy.guid) > -1 || zaMobs.indexOf(enemy.guid) > -1 || swMobs.indexOf(enemy.guid) > -1)) {
              if (karaMobs.indexOf(enemy.guid) > -1)
                raidZoneFound = karaZoneID;
              else if (sscMobs.indexOf(enemy.guid) > -1)
                raidZoneFound = sscZoneID;
              else if (tkMobs.indexOf(enemy.guid) > -1)
                raidZoneFound = tkZoneID;
              else if (mhMobs.indexOf(enemy.guid) > -1)
                raidZoneFound = mhZoneID;
              else if (btMobs.indexOf(enemy.guid) > -1)
                raidZoneFound = btZoneID;
              else if (zaMobs.indexOf(enemy.guid) > -1)
                raidZoneFound = zaZoneID;
              else if (swMobs.indexOf(enemy.guid) > -1)
                raidZoneFound = swZoneID;
            }
          })
        })
      }
      if (raidZoneFound != -1) {
        zonesFound[zonesFound.length] = [];
        zonesFound[zonesFound.length - 1].push(raidZoneFound);
        zonesFound[zonesFound.length - 1].push(zoneStart);
        zonesFound[zonesFound.length - 1].push(zoneEnd);
        zonesFound[zonesFound.length - 1].push(zoneStartRaw);
        zonesFound[zonesFound.length - 1].push(zoneEndRaw);
        if (karaZoneID == raidZoneFound)
          zonesFound[zonesFound.length - 1].push("Kara");
        else if (sscZoneID == raidZoneFound)
          zonesFound[zonesFound.length - 1].push("SSC");
        else if (tkZoneID == raidZoneFound)
          zonesFound[zonesFound.length - 1].push("TK");
        else if (mhZoneID == raidZoneFound)
          zonesFound[zonesFound.length - 1].push("MH");
        else if (btZoneID == raidZoneFound)
          zonesFound[zonesFound.length - 1].push("BT");
        else if (zaZoneID == raidZoneFound)
          zonesFound[zonesFound.length - 1].push("ZA");
        else if (swZoneID == raidZoneFound)
          zonesFound[zonesFound.length - 1].push("SW");
        else {
          if (fight.zoneName != null && fight.zoneName.toString().length > 0)
            zonesFound[zonesFound.length - 1].push(fight.zoneName);
        }
        zonesFound[zonesFound.length - 1].push("false"); //startPointFound
        zonesFound[zonesFound.length - 1].push("false"); //endbossFound
        zonesFound[zonesFound.length - 1].push("false"); //firstBossFound
        zonesFound[zonesFound.length - 1].push("false"); //atLeastOneStartPointFoundAfterXSecondsInfight
        zonesFound[zonesFound.length - 1].push(0); //WCLTotalTime
        zonesFound[zonesFound.length - 1].push(0); //WCLPenaltyTime
      }
    }
    var startPointFoundStart = false;
    var startPointFoundEnd = false;
    var endbossFound = false;
    allFightsData.enemies.forEach(function (enemy, enemyCount) {
      enemy.fights.forEach(function (enemyFight, enemyFightCount) {
        if (enemyFight.id == fight.id && (enemy.type == "NPC" || enemy.type == "Boss")) {
          if ((raidZoneFound == karaZoneID && karaStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == sscZoneID && sscStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == tkZoneID && tkStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == mhZoneID && mhStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == btZoneID && btStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == zaZoneID && zaStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == swZoneID && swStartPoint.indexOf(enemy.guid) > -1)) {
            if (((enemy.guid == "21216") && fight.boss != null && fight.boss > 0) || enemy.guid != "21216") {
              startPointFoundStart = true;
            }
          } else if ((raidZoneFound == karaZoneID && karaStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == sscStartPoint && sscStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == tkZoneID && tkStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == mhZoneID && mhStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == btZoneID && btStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == zaZoneID && zaStartPoint.indexOf(enemy.guid) > -1) || (raidZoneFound == swZoneID && swStartPoint.indexOf(enemy.guid) > -1)) {
            if (queryEnemyFilled) {
              var queryEnemyData = wclV1Fetch_(queryEnemy + enemy.id.toString() + "&start=" + fight.start_time.toString() + "&end=" + (fight.start_time + maxMillisecondsInfight).toString(), { method: "GET" });
              if (queryEnemyData != null && queryEnemyData.events != null && queryEnemyData.events.length > 0)
                startPointFoundStart = true;
              else
                atLeastOneStartPointFoundAfterXSecondsInfight = true;
              Utilities.sleep(50);
            } else
              startPointFoundStart = true;
          }
        }
        if (fight.boss != null && Number(fight.boss) > 0 && fight.kill == true && (raidZoneFound == karaZoneID && karaEndbosses.indexOf(fight.boss) > -1) || (raidZoneFound == sscZoneID && sscEndbosses.indexOf(fight.boss) > -1) || (raidZoneFound == tkZoneID && tkEndbosses.indexOf(fight.boss) > -1) || (raidZoneFound == mhZoneID && mhEndbosses.indexOf(fight.boss) > -1) || (raidZoneFound == btZoneID && btEndbosses.indexOf(fight.boss) > -1) || (raidZoneFound == zaZoneID && zaEndbosses.indexOf(fight.boss) > -1) || (raidZoneFound == swZoneID && swEndbosses.indexOf(fight.boss) > -1))
          endbossFound = true;
      })
    })
    if (startPointFoundStart) {
      if (zoneStart == -1 || fight.start_time < zoneStart) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZoneFound == raidZone[0] && raidZone[8] == "false") {
            raidZone[1] = fight.start_time;
            raidZone[6] = "true";
          }
        })
      }
    } else if (startPointFoundEnd) {
      if (zoneStart == -1 || fight.end_time < zoneStart) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZoneFound == raidZone[0] && raidZone[8] == "false") {
            raidZone[1] = fight.end_time;
            raidZone[6] = "true";
          }
        })
      }
    } else {
      zonesFound.forEach(function (raidZone, raidZoneCount) {
        if (atLeastOneStartPointFoundAfterXSecondsInfight)
          raidZone[9] = "true";
      })
    }
    if (fight.boss != null && Number(fight.boss) > 0 && fight.kill != null && fight.kill.toString() == "true") {
      zonesFound.forEach(function (raidZone, raidZoneCount) {
        if (raidZoneFound == raidZone[0] && raidZone[8] == "false") {
          raidZone[8] = "true";
        }
      })
    }
    if (endbossFound) {
      if (zoneEnd == -1 || fight.end_time > zoneEnd) {
        zonesFound.forEach(function (raidZone, raidZoneCount) {
          if (raidZoneFound == raidZone[0]) {
            raidZone[2] = fight.end_time;
            raidZone[7] = "true";
          }
        })
      }
    }
  })
  zonesFound.forEach(function (raidZone, raidZoneCount) {
    allFightsData.fights.forEach(function (fight, fightCount) {
      if (validZones.indexOf(fight.zoneID) > -1) {
        if (fight.zoneID == raidZone[0] && (raidZone[3] == -1 || fight.start_time < raidZone[3]))
          raidZone[3] = fight.start_time;
      } else {
        allFightsData.enemies.forEach(function (enemy, enemyCount) {
          enemy.fights.forEach(function (enemyFight, enemyFightCount) {
            if (fight.id == enemyFight.id && (karaMobs.indexOf(enemy.guid) > -1 || sscMobs.indexOf(enemy.guid) > -1 || tkMobs.indexOf(enemy.guid) > -1 || mhMobs.indexOf(enemy.guid) > -1 || btMobs.indexOf(enemy.guid) > -1 || zaMobs.indexOf(enemy.guid) > -1 || swMobs.indexOf(enemy.guid) > -1)) {
              if (karaMobs.indexOf(enemy.guid) > -1 && (karaZoneID == raidZone[0] && (raidZone[3] == -1 || fight.start_time < raidZone[3])))
                raidZone[3] = fight.start_time;
              else if (sscMobs.indexOf(enemy.guid) > -1 && (sscZoneID == raidZone[0] && (raidZone[3] == -1 || fight.start_time < raidZone[3])))
                raidZone[3] = fight.start_time;
              else if (tkMobs.indexOf(enemy.guid) > -1 && (tkZoneID == raidZone[0] && (raidZone[3] == -1 || fight.start_time < raidZone[3])))
                raidZone[3] = fight.start_time;
              else if (mhMobs.indexOf(enemy.guid) > -1 && (mhZoneID == raidZone[0] && (raidZone[3] == -1 || fight.start_time < raidZone[3])))
                raidZone[3] = fight.start_time;
              else if (btMobs.indexOf(enemy.guid) > -1 && (btZoneID == raidZone[0] && (raidZone[3] == -1 || fight.start_time < raidZone[3])))
                raidZone[3] = fight.start_time;
              else if (zaMobs.indexOf(enemy.guid) > -1 && (zaZoneID == raidZone[0] && (raidZone[3] == -1 || fight.start_time < raidZone[3])))
                raidZone[3] = fight.start_time;
              else if (swMobs.indexOf(enemy.guid) > -1 && (swZoneID == raidZone[0] && (raidZone[3] == -1 || fight.start_time < raidZone[3])))
                raidZone[3] = fight.start_time;
            }
          })
        })
      }
    })
    if (raidZone[1] == -1) {
      raidZone[1] = raidZone[3];
    }

    allFightsData.fights.forEach(function (fight, fightCount) {
      if (validZones.indexOf(fight.zoneID) > -1) {
        if (fight.zoneID == raidZone[0] && (raidZone[4] == -1 || fight.end_time > raidZone[4]))
          raidZone[4] = fight.end_time;
      } else {
        allFightsData.enemies.forEach(function (enemy, enemyCount) {
          enemy.fights.forEach(function (enemyFight, enemyFightCount) {
            if (fight.id == enemyFight.id && (karaMobs.indexOf(enemy.guid) > -1 || sscMobs.indexOf(enemy.guid) > -1 || tkMobs.indexOf(enemy.guid) > -1 || mhMobs.indexOf(enemy.guid) > -1 || btMobs.indexOf(enemy.guid) > -1 || zaMobs.indexOf(enemy.guid) > -1 || swMobs.indexOf(enemy.guid) > -1)) {
              if (karaMobs.indexOf(enemy.guid) > -1 && (karaZoneID == raidZone[0] && (raidZone[4] == -1 || fight.end_time > raidZone[4])))
                raidZone[4] = fight.end_time;
              else if (sscMobs.indexOf(enemy.guid) > -1 && (sscZoneID == raidZone[0] && (raidZone[4] == -1 || fight.end_time > raidZone[4])))
                raidZone[4] = fight.end_time;
              else if (tkMobs.indexOf(enemy.guid) > -1 && (tkZoneID == raidZone[0] && (raidZone[4] == -1 || fight.end_time > raidZone[4])))
                raidZone[4] = fight.end_time;
              else if (mhMobs.indexOf(enemy.guid) > -1 && (mhZoneID == raidZone[0] && (raidZone[4] == -1 || fight.end_time > raidZone[4])))
                raidZone[4] = fight.end_time;
              else if (btMobs.indexOf(enemy.guid) > -1 && (btZoneID == raidZone[0] && (raidZone[4] == -1 || fight.end_time > raidZone[4])))
                raidZone[4] = fight.end_time;
              else if (zaMobs.indexOf(enemy.guid) > -1 && (zaZoneID == raidZone[0] && (raidZone[4] == -1 || fight.end_time > raidZone[4])))
                raidZone[4] = fight.end_time;
              else if (swMobs.indexOf(enemy.guid) > -1 && (swZoneID == raidZone[0] && (raidZone[4] == -1 || fight.end_time > raidZone[4])))
                raidZone[4] = fight.end_time;
            }
          })
        })
      }
    })
    if (raidZone[2] == -1) {
      raidZone[2] = raidZone[4];
    }
  })
  zonesFound.forEach(function (raidZone, raidZoneCount) {
    if (allFightsData.completeRaids != null) {
      allFightsData.completeRaids.forEach(function (completeRaid, completeRaidCount) {
        if (completeRaid.start_time == raidZone[1]) {
          raidZone[10] = completeRaid.end_time - completeRaid.start_time;
          var timePenalty = 0;
          if (completeRaid.missedTrashDetails != null) {
            completeRaid.completeRaid.missedTrashDetails.forEach(function (missedTrashDetail, missedTrashDetailCount) {
              if (missedTrashDetail.timePenalty != null && missedTrashDetail.timePenalty > 0)
                timePenalty += missedTrashDetail.timePenalty;
            })
          }
          raidZone[11] = timePenalty;
          if (raidZone[2] - raidZone[1] > raidZone[10])
            raidZone[2] = raidZone[1] + raidZone[10];
        }
      })
    }
  })
  return { zonesFound };
}

function toggleDarkMode() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = SpreadsheetApp.getActiveSheet();
  var instructionsSheet = ss.getSheetByName("Instructions");

  var confSpreadSheet = SpreadsheetApp.openById('1pIbbPkn9i5jxyQ60Xt86fLthtbdCAmFriIpPSvmXiu0');

  var lang = shiftRangeByColumns(instructionsSheet, instructionsSheet.createTextFinder("^1.$").useRegularExpression(true).findNext(), 4).getValue();
  var langSheet = confSpreadSheet.getSheetByName("langTexts");
  var offset;
  if (lang != null && lang == "English") {
    lang = "EN";
    offset = 1;
  } else if (lang != null && lang == "Deutsch") {
    lang = "DE";
    offset = 2;
  } else if (lang != null && lang == "简体中文") {
    lang = "CN";
    offset = 3;
  } else if (lang != null && lang == "русский") {
    lang = "RU";
    offset = 4;
  } else if (lang != null && lang == "français") {
    lang = "FR";
    offset = 5;
  } else {
    lang = "EN";
    offset = 1;
  }
  var langKeys = langSheet.getRange(1, 1, 1000, 1).getValues().reduce(function (ar, e) { ar.push(e[0]); return ar; }, []);
  var langTrans = langSheet.getRange(1, 1 + offset, 1000, 1).getValues().reduce(function (ar, e) { ar.push(e[0]); return ar; }, []);

  var darkMode = false;
  try {
    var infoShownCellRange = shiftRangeByRows(instructionsSheet, shiftRangeByColumns(instructionsSheet, instructionsSheet.createTextFinder("^" + getStringForLang("email", langKeys, langTrans, "", "", "", "") + "$").useRegularExpression(true).findNext(), -1), 5);
    if (infoShownCellRange.getValue().indexOf("no") > -1) {
      infoShownCellRange.setValue("yes");
      SpreadsheetApp.getUi().alert(getStringForLang("toggleModeFirstInfo", langKeys, langTrans, "", "", "", ""));
    }
    var darkModeCellRange = shiftRangeByRows(instructionsSheet, shiftRangeByColumns(instructionsSheet, instructionsSheet.createTextFinder("^" + getStringForLang("email", langKeys, langTrans, "", "", "", "") + "$").useRegularExpression(true).findNext(), -1), 4);
    var darkModeValue = darkModeCellRange.getValue();
    if (darkModeValue.indexOf("yes") > -1)
      darkMode = true;
  } catch { }

  if (!darkMode) {
    darkModeCellRange.setValue("yes");
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setBackground("#d9d9d9").setBorder(true, true, true, true, true, true, "#d9d9d9", SpreadsheetApp.BorderStyle.SOLID);
    darkModeCellRange.setFontColor("#d9d9d9");
    infoShownCellRange.setFontColor("#d9d9d9");
  } else {
    darkModeCellRange.setValue("no");
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setBackground("white").setBorder(true, true, true, true, true, true, "white", SpreadsheetApp.BorderStyle.SOLID);
    darkModeCellRange.setFontColor("white");
    infoShownCellRange.setFontColor("white");
  }
  sheet.getRange(5, 5, 11, 1).setBackground("#fce5cd").setBorder(true, true, true, true, true, true, "#fce5cd", SpreadsheetApp.BorderStyle.SOLID).setFontColor("black");
  sheet.getRange(7, 5, 1, 1).setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(9, 5, 1, 1).setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(11, 5, 1, 1).setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(13, 5, 1, 1).setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(15, 5, 1, 1).setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(25, 6, 7, 1).setBackground("#fce5cd").setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(25, 5, 7, 2).setBorder(true, true, true, true, null, null, "black", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

function getStringForLang(key, langkeys, langTrans, param1, param2, param3, param4) {
  if (langkeys.indexOf(key) > -1)
    return langTrans[langkeys.indexOf(key)].replace("<param1>", param1).replace("<param2>", param2).replace("<param3>", param3).replace("<param4>", param4);
  else {
    return "missing/fehlend/manquant/失踪/отсутствует";
  }
}

function getColourForPlayerClass(playerClass) {
  if (playerClass == "Druid")
    return "#f6b26b";
  else if (playerClass == "Hunter")
    return "#b6d7a8";
  else if (playerClass == "Mage")
    return "#a4c2f4";
  else if (playerClass == "Paladin")
    return "#d5a6bd";
  else if (playerClass == "Priest")
    return "#efefef";
  else if (playerClass == "Rogue")
    return "#fff2cc";
  else if (playerClass == "Shaman")
    return "#6d9eeb";
  else if (playerClass == "Warlock")
    return "#b4a7d6";
  else if (playerClass == "Warrior")
    return "#e2d3c9";
}

function sortByProperty(objArray, prop) {
  if (arguments.length < 2) throw new Error("ARRAY, AND OBJECT PROPERTY MINIMUM ARGUMENTS, OPTIONAL DIRECTION");
  if (!Array.isArray(objArray)) throw new Error("FIRST ARGUMENT NOT AN ARRAY");
  const clone = objArray.slice(0);
  const direct = arguments.length > 2 ? arguments[2] : 1; //Default to ascending
  const propPath = (prop.constructor === Array) ? prop : prop.split(".");
  clone.sort(function (a, b) {
    for (let p in propPath) {
      if (a[propPath[p]] && b[propPath[p]]) {
        a = a[propPath[p]];
        b = b[propPath[p]];
      }
    }
    // convert numeric strings to integers
    a = a.toString().match(/^\d+$/) ? +a : a;
    b = b.toString().match(/^\d+$/) ? +b : b;
    return ((a < b) ? -1 * direct : ((a > b) ? 1 * direct : 0));
  });
  return clone;
}

function searchEntryForId(idArray, dataArray, index) {
  var count = 0;
  var returnvalue = "";
  idArray.forEach(function (id, idCount) {
    if (id.toString() == index.toString())
      returnvalue = dataArray[count];
    count++;
  })
  return returnvalue;
}

function addSingleEntryToMultiDimArray(multiArray, value) {
  multiArray[multiArray.length] = [];
  multiArray[multiArray.length - 1].push(value);
}

function addColumnsToRange(sheet, range, columnsToAdd) {
  return sheet.getRange(range.getRow(), range.getColumn(), range.getNumRows(), range.getNumColumns() + columnsToAdd);
}

function addRowsToRange(sheet, range, rowsToAdd) {
  return sheet.getRange(range.getRow(), range.getColumn(), range.getNumRows() + rowsToAdd, range.getNumColumns());
}

function shiftRangeByColumns(sheet, range, columnsToShift) {
  return sheet.getRange(range.getRow(), range.getColumn() + columnsToShift, range.getNumRows(), range.getNumColumns());
}

function shiftRangeByRows(sheet, range, rowsToShift) {
  return sheet.getRange(range.getRow() + rowsToShift, range.getColumn(), range.getNumRows(), range.getNumColumns());
}
