// [事前作業]
//  GASライブラリに「OAuth2」を追加すること。（ID「1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF」で検索）

function getService() {
  var privateKey = "xxxxxxx";                                  // [変更点]サービスアカウント認証用JSONのprivate_key
  var clientEmail = "xxxxx@xxxxxxxx.iam.gserviceaccount.com";  // [変更点]サービスアカウント認証用JSONのclient_email

  return OAuth2.createService("PaasConnect")
    .setPrivateKey(privateKey)
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setTokenUrl('https://www.googleapis.com/oauth2/v4/token')
    .setAdditionalClaims({
      "target_audience": "https://asia-northeast1-kccs-apiservice-prod-210201.cloudfunctions.net/kccsapiPaasConnect",  // [変更点]ReverseProxyサーバーのURL
      "aud": "https://www.googleapis.com/oauth2/v4/token",
    })
}

function getKccsApiWeatherData() {
  var service = getService();
  service.exchangeJwt_();
  if (!service.hasAccess()) {
    console.log("!service.hasAccess()");
    return;
  }

  var token = service.getIdToken();
  console.log(token);

  // HTTPアクセス用URL
  //  [変更点]ReverseProxyサーバーのURL。
  //  [変更点] "/api/v1" 以降は気象予報データ配信APIの仕様に従う。
  var url = "https://asia-northeast1-kccs-apiservice-prod-210201.cloudfunctions.net/kccsapiPaasConnect/api/v1/forecasts/?latitude=35.642507&longitude=139.741836&suninfo=1&forecasts=wind_velocity,wind_direction,tmp_1d5maboveground,rh_1d5maboveground,apcp_surface,tcdc_surface,dswrf_surface";

  var response = UrlFetchApp.fetch(url, {
    headers: {
      "Authorization": "Bearer " + token,
      "X-KCCS-API-USER": "xxxxxxxxx",            // [変更点]KCCS APIサービスの アクセスキーID
      "X-KCCS-API-TOKEN": "xxxxxxxx"             // [変更点]KCCS APIサービスの シークレットアクセスキー
    },
    method: "GET",
    muteHttpExceptions: true,
  });

  console.info(response.getResponseCode());
  console.info(response.getContentText());
}
