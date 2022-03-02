# SPPK
### SimplyPlural -> PluralKit Connectivity.

### Fork this repository and simply deploy to Heroku!
This project already has a Procfile set up, so it's super easy to get started. Once you have forked / cloned this repo, you can connect it to Heroku and fill in your credentials as config variables. More info below.

#### Environment Variables
These can be set either in the .env file, in terminal, or in the config vars section of Heroku.
| Setting  | Default | Description        |
| ---------| ------- | ------------------ |
| url  | https://devapi.apparyllis.com | The base URL for all SimplyPlural API requests. Unless you are running your own fork of Simply Plural, you shouldn't change this.  |
| socket  | wss://devapi.apparyllis.com/v1/socket | The socket URL for SimplyPlural. Unless you are running your own fork of Simply Plural, you shouldn't change this.  |
| pk_url | https://api.pluralkit.me/v2 | The base URL for all PluralKit API requests. Unless you are running your own fork of PluralKit, you shouldn't change this. |
| token | token_here | Your SimplyPlural account token. As of now, the only permission necessary is the Read permission. |
| userId | user_id | Your SimplyPlural account/system ID. You can find it in account info near the bottom. |
| pk_token | pluralkit_token_here | Your PluralKit token. Get it by using `pk;token`. |
| pk_system | pluralkit_system_id | Your Pluralkit system ID. This can be either your Discord account ID or your 5 letter ID shown by using pk;system. |
| heartbeat | 4500000 | The time in miliseconds before the websocket client reconnects to the websocket server. |