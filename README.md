# dymc-bot

Discord youtube membership checker, or dymc for short. Is a simple bot that desing to ues in unofficial youtuber/vtuber fan server for membership checking.


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

```javascript
{
    "bot_token": "botTokenHere",
    "user_token": ["userTokenHere"],
    "channelId": "someIdThatStartWithU", // Youtube channel ID
    "roleId": "000000000000000000",
    "removeRoleUndetectedAfter": 15, // Days
    "updateUserProflie": 6, // Hours
    "discordRequestDelay": 10, // seconds
    "analysisDataOnTextChannelId": "",
    "channelExcludeVideoIds": [],
    "newMemberBadge": "badgeUrlHere",
    "channelAvatar": ""
}
```

#### `bot_token` 

Go to https://discord.com/developers/applications and create New Applications > Bot > TOKEN, and then enable `Presence Intent` and `Server Members Intent` under the Privileged Gateway Intents.

#### `user_token`

See how to get your user token https://youtu.be/WWHZoa0SxCc , you can add miltiple user token to reduce fetch member time on first startup.

#### `roleId`

The discord role you want to add on verified users. Type `\@yourRoleName` on discord to get it.

#### `removeRoleUndetectedAfter`

If user undetected more then this value, remove user role.

#### `updateUserProflie`

Update database every this value, set to 0 if you don't want to update.

#### `discordRequestDelay`

Delay between each request to discord.

#### `analysisDataOnTextChannelId`

When stream ended, the analysis data will send to this text channel. leave it blank if you don't want it.

#### `channelExcludeVideoIds`

if the channel have videos that not gonna stream, like free chat or something.

#### `newMemberBadge`

Copy paste the channel new member badge URL, it will look something like this `https://yt3.ggpht.com/i01Y-UCqkjUUeu8TpuXt1hMz7P1ab0vKWesen6OIIGDveOu1m5eOcb8osqnANOPpdyna6RzUkA=s16-c-k`



And then type in `npm start` to start the bot.
