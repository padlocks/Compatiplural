# Compatiplural
### SimplyPlural -> PluralKit Connectivity.
Compatiplural is a small application which enables the transfer of your SimplyPlural data to PluralKit.

### Fork this repository and simply deploy to Heroku!
This project already has a Procfile set up, so it's super easy to get started. Once you have forked / cloned this repo, you can connect it to Heroku and fill in your credentials as config variables. More info below.

#### Environment Variables
These can be set either in the .env file, in terminal, or in the config vars section of Heroku.
| Setting  | Default | Description        |
| ---------| ------- | ------------------ |
| url_override  | https://api.apparyllis.com | The base URL for all SimplyPlural API requests. Unless you are running your own fork of Simply Plural, you shouldn't change this.  |
| api_version  | v1 | The target SimplyPlural API version. Unless you are running your own fork of Simply Plural, you shouldn't change this.  |
| socket  | wss://api.apparyllis.com/v1/socket | The socket URL for SimplyPlural. Unless you are running your own fork of Simply Plural, you shouldn't change this.  |
| pk_url | https://api.pluralkit.me/v2 | The base URL for all PluralKit API requests. Unless you are running your own fork of PluralKit, you shouldn't change this. |
| token | token_here | Your SimplyPlural account token. As of now, the only permission necessary is the Read permission. |
| userId | user_id | Your SimplyPlural account/system ID. You can find it in account info near the bottom. |
| pk_token | pluralkit_token_here | Your PluralKit token. Get it by using `pk;token`. |
| heartbeat | 4500000 | The time in miliseconds before the websocket client reconnects to the websocket server. |
| max_workers | 1 | Max number of workers for processing enqueued tasks. This probably shouldn't be changed. |
| silence_connections | true | Whether or not to silence the websocket connection and authentication messages. |
| full_swap | false | Determines whether to completely overwrite PluralKit's front with SimplyPlural's. No individual changes. |
