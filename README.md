# dymc-bot

Discord youtube membership checker, or dymc for short. Is a simple bot that desing to ues in unofficial youtuber fan server for membership checking.


#### ***Notice*: This bot is design to use in single server, don't use in mulitple server simultaneously.**

<!-- peko peko peko -->
<!-- Other resources  -->
<!-- HoloApi - https://api.holotools.app/v1/api-docs/#section/About -->

## Requirement
* node.js version `12.18.3` or higher
* Discord bot and user token

This project require `puppeteer`, your node_modules will ~~be EVEN FATTER~~ use a lot of space (≅ 390MB).

## How it work

It will fetch all discord users proflie to get youtube channel ID, and then compare to live stream chat.

So the user want to be verify need to connect it youtube account to discord first (need to display on profile), and then send a message/superChat or join member when live streming.

All data will store locally on `./db` folder.

## Quick start

Open `config.json` and change those string before you start the bot.

```json
{
    "bot_token": "botTokenHere", // Go to https://discord.com/developers/applications and create New Applications > Bot > TOKEN
    "user_token": "userTokenHere", // See how to get your user token https://youtu.be/WWHZoa0SxCc
    "channelId": "someIdThatStartWithU", // Youtube channel ID
    "roleId": "000000000000000000", // The discord role you want to add on verified users. Type \@yourRoleName on discord to get it.
    "removeRoleUndetectedAfter": 15, // Days // if user undetected more then this value, remove user role."
    "analysisDataOnTextChannelId": "", // when stream ended, the analysis data will send to this text channel. leave it blank if you don't want it.
    "channelExcludeVideoIds": []  // if the channel have video that not gonna stream, like free chat or something.
}
```
And then type in `npm start` to start the bot.