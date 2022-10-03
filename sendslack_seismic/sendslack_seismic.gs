const project = '<Google Cloud Project ID>';
const sub = '<Google Cloud subscription ID>'
const maxMessages = 3
const slackID = 'https://hooks.slack.com/services/<slack id>'  // [変更点]<slack id>を適切なものに変更してください。
const key_file = '<jsonファイル名>'  // [変更点]<jsonファイル名>を適切なものに変更してください。あわせてキーJsonファイルをDriveにアップしてください。

function main() {
  // 認証確認
  var access = pubsubAccess()
  if (access) {
    // pullでmessage取得
    var ret = pull(sub);
    // retの値がnullでなければslack通知する
    if (ret) {
      // slack通知用メッセージ作成
      makeMessage(sub, ret)
    }
  }
}

//GoogleCloudサブスクリプションからデータをPULLする
function pull(sub) {
  var service = getService();
  
  // [変更点] [PROJECT]、[SUB]を適切なものに変更してください。
  var url = 'https://pubsub.googleapis.com/v1/projects/[PROJECT]/subscriptions/[SUB]:pull'
  .replace("[SUB]", sub)
  .replace("[PROJECT]", project);
    
  var body = {
    "returnImmediately": false,
    "maxMessages": maxMessages
  };

    var response = UrlFetchApp.fetch(url, {
    method: "POST",
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(body),
    headers: {
      Authorization: 'Bearer ' + service.getAccessToken()
    }
  });
 
  var result = JSON.parse(response.getContentText());

  return {
    result: result
  }    
} 

function pubsubAccess() {
  // var ss = SpreadsheetApp.getActive();
  var service = getService();
  
  if (!service.hasAccess()) {
    var authorizationUrl = service.getAuthorizationUrl();
    var template = HtmlService.createTemplate(
      '<a href="<?= authorizationUrl ?>" target="_blank">Authorize</a>. ' +
      'Reopen the sidebar when the authorization is complete.');
    template.authorizationUrl = authorizationUrl;
    var page = template.evaluate();
    Logger.log(template.authorizationUrl)
  } else {
    return true
  }
}

// サービスアカウント認証
function getService() {
 var key = TokenImported(key_file) // dev
  return OAuth2.createService("google_apps_script")
    .setTokenUrl(key.token_uri)
    .setPrivateKey(key.private_key)
    .setIssuer(key.client_email)
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setScope(['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/pubsub','https://www.googleapis.com/auth/script.external_request'])
}

function makeMessage(sub, ret) 
{
  // response jsonにreceivedMessagesが取得できているか確認
  if (ret["result"]["receivedMessages"]) {
    var result = ret["result"]["receivedMessages"]
    
    // 返却用のackIds
    var ackIds = []
  
    // resultをループして中身確認
    for(var key in result) {

      // ackId取得
      var ackId = result[key]["ackId"]
      
      // message取得
      var receivedMessages = Utilities.base64Decode(result[key]["message"]["data"], Utilities.Charset.UTF_8)

      // Base64デコード
      var message = Utilities.newBlob(receivedMessages).getDataAsString()

      // slack通知用にメッセージ編集
      var text = replaceMessage(message)

      // slack通知
      title = "震度概要通知（都道府県）"
      iconEmoji = ':warning:'
      res = sendSlackMessage(title , iconEmoji, text)
      Logger.log("Message: " + sub + text)

      // slack通知がokの場合はackIdをセット
      if (res == "ok") {
        ackIds.push(ackId);
      }
    }
    // Pub/Subへack返却
    if (ackIds.length > 0) {
      acknowledge(sub, ackIds);
    }
  } else {
    Logger.log("No Pub/Sub Message: " + sub + text)
  }
}

function decodeBase64(text) {
  var dec = Utilities.base64Decode(text, Utilities.Charset.UTF_8);
  return Utilities.newBlob(dec).getDataAsString()
}

function replaceMessage(text) {

  var jsonObject = JSON.parse(text)
  var jsonReportDatetime = jsonObject.report_datetime //発表日時
  var jsonOriginTime = jsonObject.body.earthquake.origin_time　//発生時刻
  var jsonHypocenterArea = jsonObject.body.earthquake.hypocenter.area.name //震央地名
  var jsonMagnitudeDescription =  jsonObject.body.earthquake.magnitude_description //震源地マグニチュード文字列
  var jsonMaxInt = jsonObject.body.intensity.observation.max_int //最大震度
  var jsonPref = jsonObject.body.intensity.observation.pref //エリアごとの震度情報

  jsonString = "発表日時：" + getStringFromDate(jsonReportDatetime) + "\n" 
              + "発生時刻：" + getStringFromDate(jsonOriginTime) + "\n"
              + "震央地名：" + jsonHypocenterArea + "\n" 
              + "震源地マグニチュード文字列：" + jsonMagnitudeDescription + "\n" 
              + "最大震度：" + jsonMaxInt + "\n" 
              + "各都道府県の最大震度は下記の通り：\n"
  var jsonArray=[]
  for(i=0;i<jsonPref.length;i++){
    jsonArray.push("     " + jsonPref[i]["name"]+ "の最大震度："　+　jsonPref[i]["max_int"])
  }
  var jsonArrayString = jsonArray.join("\n");
  var jsonString = jsonString + jsonArrayString 
  return jsonString
}

// Slack通知
function sendSlackMessage( title , iconEmoji , message ){

  var options =
  {
    "method" : "post",
    "contentType" : "application/json",
    "muteHttpExceptions": true,
    "payload" : JSON.stringify({
      "username" : title,
      "icon_emoji" : iconEmoji ,
      "text" : message
    })
  };

  try {
    var res = UrlFetchApp.fetch(slackID, options);
    Logger.log(res)
    return res
  } catch(e) {
    // 例外エラー処理
    Logger.log('Error:')
    Logger.log(e)
    return null
  }
}

// Jsonファイルから値を取得
function TokenImported(file_name) {
  var fileIT = DriveApp.getFilesByName(file_name).next();
  var textdata = fileIT.getBlob().getDataAsString('utf8');
  var jobj = JSON.parse(textdata);

  return jobj;
}

function acknowledge(sub, ackIds) {
  var service = getService();
  
  // [変更点] [PROJECT]、[SUB]を適切なものに変更してください。
  var url = 'https://pubsub.googleapis.com/v1/projects/[PROJECT]/subscriptions/[SUB]:acknowledge'
  .replace("[SUB]", sub)
  .replace("[PROJECT]", project);
    
  // The data attribute is of 'string' type and needs to be base64 Encoded!
  var body = {
    "ackIds": ackIds,
  };
  
  var response = UrlFetchApp.fetch(url, {
    method: "POST",
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(body),
    headers: {
      Authorization: 'Bearer ' + service.getAccessToken()
    }
  });
  Logger.log("acknowledge response: " + response)
}

//日付から文字列に変換する関数
function getStringFromDate(date , format_str = 'YYYY-MM-DD hh:mm' ) {

  date = new Date(date)
  var year_str = date.getFullYear();
  //月だけ+1すること
  var month_str = 1 + date.getMonth();
  var day_str = date.getDate();
  var hour_str = date.getHours();
  var minute_str = date.getMinutes();
  var second_str = date.getSeconds();

  month_str = ('0' + month_str).slice(-2);
  day_str = ('0' + day_str).slice(-2);
  hour_str = ('0' + hour_str).slice(-2);
  minute_str = ('0' + minute_str).slice(-2);
  second_str = ('0' + second_str).slice(-2);

  format_str = format_str.replace(/YYYY/g, year_str);
  format_str = format_str.replace(/MM/g, month_str);
  format_str = format_str.replace(/DD/g, day_str);
  format_str = format_str.replace(/hh/g, hour_str);
  format_str = format_str.replace(/mm/g, minute_str);
  format_str = format_str.replace(/ss/g, second_str);

  return format_str;
};