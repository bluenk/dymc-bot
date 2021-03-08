const { Client, MessageEmbed } = require('discord.js');
const puppeteer = require('puppeteer');
const level = require('level');
const colors = require('colors');
const ora = require('ora');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const fs = require('fs');
const config = require('./config.json');

const client = new Client();
const isFirstStart = !fs.existsSync('./db');
const haveMultipleUserToken = config['user_token'].length > 1;
let db;
let guildId;
let newGuildMember = [];
let userToken = config['user_token'][0];
let channelIcon = config['channelAvatar'];
let channelName;

// ls for loading spinner
const ls = ora({ interval: 250 });
const loopDelay = {
    youtube: 1, // minute
    updateDB: config['updateUserProflie'], // hours
    discordProfile: config['discordRequestDelay'] // second
};
const permissions = 8;

const configCheck = (
    config['bot_token'] == 'botTokenHere' ||
    config['user_token'] == ['userTokenHere'] ||
    config['channelId'] == 'someIdThatStartWithU' ||
    config['roleId'] == '000000000000000000' ||
    config['newMemberBadge'] == 'badgeUrlHere'
)

if (configCheck) {
    console.log('Change config.json before you strat the bot.'.bgYellow.black);
    process.exit();
}


client.on('ready',async () => {

    console.log('Logged in as ' + client.user.tag.yellow + ', running...');
    console.log('Start process, checking channel every ' + loopDelay.youtube + ' minute');

    const guildsLength = Array.from(client.guilds.cache.keys()).length;
    if (guildsLength != 1) {
        if (guildsLength < 1) {
            console.log((
                'Invite the bot into server before you start it.' + '\n' + 
                'Go to this page and select the server you want ' +
                'https://discord.com/oauth2/authorize?' + 
                'client_id=' + client.user.id + 
                '&scope=bot&permissions=' + permissions
            ).bgYellow.black);
            process.exit();
        } else {
            console.log('This bot only work with ONE server at the same time.'.bgYellow.black);
            process.exit();
        }
    }

    guildId = client.guilds.cache.firstKey();
    db = level('./db', { valueEncoding: 'json' });

    if (isFirstStart) {
        await getDiscordYtIdList(ls);
        await addNewGuildMember();
    }

    if (loopDelay.updateDB != 0) {
        updateDBtimer();
    }
    
    

    mainProcess();
});

client.on('message', msg => {

    if (msg.content == 'd.ping') msg.channel.send('pong!');

});

client.on('guildMemberAdd', () => {
    const discordId = member.user.id;
    newGuildMember.push(discordId);
});

function mainProcess() {
    ls.start('Finding live stream video...');

    checkProcess(config['channelId'], ls)
        .then(id => {
            if (!id) return;
            liveStramProcess(id, ls);
        })
        .catch(err => {
            ls.fail();
            console.log(err, '\nAn Error occurred, checkProcess has stopped.'.bgRed);
        });
}

const addNewGuildMember =  async () => {
    if (!newGuildMember) return;

    for (discordId of newGuildMember) {
        try {
            const proflie = await getUserProfile(discordId).catch(err => {throw err});

            if (!proflie) return;

            db.put(proflie.key.youtubeId, proflie.value, (err) => {
                if (err) throw err;
            });
        } catch(err) {
            console.log(err, '\nAn error occurred on addNewGuildMember function.'.bgRed);
        }
    }
    
    newGuildMember = [];
}

const updateDBtimer = async () => {
    await sleep(loopDelay.updateDB * 3600 * 1000);
    await addNewGuildMember();

    const onlineUser = (await client.guilds.fetch(guildId)).members.cache.filter(user => user.presence.status != 'offline').array();
    for (const user of onlineUser) {
        const proflie = await getUserProfile(user.id);
        
        if (proflie) {
           db.put(proflie.key.youtubeId, proflie.value, err => {
                if (err) throw err;
            });
            await sleep(Math.ceil((loopDelay.discordProfile * 1000) / config['user_token'].length));
            db.get(proflie.key.youtubeId, (err, value) => {
                if (err) throw err;

                if (value.hasOwnProperty('youtubeMember')) {
                    if (value.youtubeMember.active == false) return;
                    const lastUpdateToNow = Date.now() - value.youtubeMember.lastUpdateAt;

                    // if doesn't been verify for a period of time, default was 15 days.
                    if (lastUpdateToNow >  config['removeRoleUndetectedAfter'] * 86400 * 1000) {
                        db.put(proflie.key.youtubeId, Object.assign(value, {
                            youtubeMember: {
                                active: false
                            }
                        }), err => {
                            if (err) throw err;
                        });
                        client.guilds.fetch(guildId).members.fetch(user.id).then(member => {
                            member.roles.remove(config['roleId']);
                        })
                    }
                }
            })
        }
    }
    return updateDBtimer();
}

const getUserProfile = (discordId) => {
    return new Promise((resolve, reject) => {
        fetch(`https://discord.com/api/v8/users/${discordId}/profile`, { headers: { authorization: userToken } })
            .then(res => {
                // console.log(res.status);
                // console.log(userTokenCount);
                // If being rate limited
                if (res.status == 429) throw Error('Reach request rete limit.');
                
                if (haveMultipleUserToken) switchUserToken();

                return res.json();
            })
            .then(data => {
                // console.log(data);
                const accountLength = data['connected_accounts'].length;
                if (accountLength) {
                    for (let i = 0; i < accountLength; i++) {
                        const account = data['connected_accounts'][i];
                        if (account['type'] == 'youtube' && account['verified'] == true) {
                            const user = data['user'];
                            resolve({
                                key: {
                                    youtubeId: account['id']
                                },
                                value: {
                                    discordId: user['id'],
                                    username: user['username'],
                                    lastUpdateAt: Date.now()
                                }
                            });
                        } else {
                            if (i == accountLength - 1) resolve(null);
                        }
                    }
                } else {
                    resolve(null);
                }
            })
            .catch(err => {
                reject(err);
            })
    })
}

const getDiscordYtIdList = async (ls) => {
    let count = 1;
    const memberList = client.guilds.cache.toJSON()[0]['members'];
    ls.start(
        'Getting Youtube ID from guild members, this may take a while to complete...(' +
        count + '/' + memberList.length + ')'
    );
    
    
    for (const discordId of memberList) {
        ls.start(
            'Getting Youtube ID from guild members, this may take a while to complete...(' +
            (count++)+ '/' + memberList.length + ')'
        );
        try {
            const profile = await getUserProfile(discordId);
            // console.log(profile);
            if (profile) {
                // const discordId = profile.discordId;
                await db.get(profile.key.youtubeId , async (err, value) => {
                    if (err) {
                        if (!err.notFound) {
                            throw err;
                        } else {
                            // if not exists in database, create new one.
                            // console.log(profile[discordId]);
                            await db.put(profile.key.youtubeId, profile.value, err => {
                                if (err) throw err;
                            })
                        }
                    } else {
                        // if already exists in database, update it.
                        await db.put(profile.key.youtubeId, profile.value , err => {
                            if (err) throw err;
                        })
                        // console.log(value);
                    }
                })
            }
        } catch(err) {
            ls.fail('Fail to get Youtube ID from guild members.');
            return console.log(err);
        } finally {
            // if server resopnse 'HTTP 429 Too Many Requests', try add some delay between request.
            const delay = loopDelay.discordProfile * 1000;
            await sleep(Math.ceil(delay / config['user_token'].length));
        }
        
    }

    ls.succeed('Got all Youtube ID from guild members successfully.');
}

const checkProcess = async (channelId, ls) => {
    // console.log(channelId);
    const liveStatusRes =
        await fetch(`https://www.youtube.com/channel/${channelId}/live`)
                .then(res => {
                    // console.log(res.status);
                    return res.text();
                })
                .then(html => {
                    const $ = cheerio.load(html);
                    const script = $('script:contains("ytInitialPlayerResponse")');
                    // console.log(script.length);

                    if (script.length <= 1) {
                        // console.log('No live stream found');
                        return null;
                    }

                    // console.log('Live stream videos: ' + script[0]['children'].length);
                    const list = [];
                    for (const c of script[0]['children']) {
                        const ytInitialPlayerResponse = JSON.parse('{' + c['data'].split(' = {')[1].slice(0, -1));
                        // console.log(ytInitialPlayerResponse);
                        list.push(ytInitialPlayerResponse);

                    }
                    // console.log(list);
                    return list;
                });
                
    
    // console.log(liveStatusRes.length);
    if (!liveStatusRes) {
        await sleep(loopDelay.youtube * 60000);
        return mainProcess();
    }
   
    // for (const data of liveStatusRes) {
    let status = liveStatusRes[0]['playabilityStatus']['status'];
    let videoId = liveStatusRes[0]['videoDetails']['videoId'];
    let title = liveStatusRes[0]['videoDetails']['title'];

    if (!channelName) {
        channelName = liveStatusRes[0]['videoDetails']['author'];
    }

    if (config['channelExcludeVideoIds'].includes(videoId)) return mainProcess();

    ls.succeed('Found a live stream video');
    console.log(
        // 'Found a live streaming video ' + '\n' +
        ' ├ status: ' + ((status == 'OK') ? 'LIVE'.red : status.yellow) + '\n' +
        ' ├ title: ' + title + '\n' +
        ' └ videoId: ' + videoId.green
    );
    // }

    return videoId;
}

const liveStramProcess = async (videoId, ls)=> {

    // Dynamic load content, ues puppeteer to run.
    ls.start('Starting browser to catch live chat respones...');
    const lunchOptions = {
        headless: false,
        defaultViewport: { width: 500, height: 470 },
        args: [`--window-size=300,600`]
    }
    const browser = await puppeteer.launch(lunchOptions);
    const page = await browser.newPage();

    await page.goto('https://www.youtube.com/live_chat?v=' + videoId);

    // Analysis data
    const memberList = new Set();
    const notMemberList = new Set();
    const chatAnalysis = {
        totalChats: 0,
        totalChatsByMembers: 0
    }

    // const logToDiscord = setInterval(() => {
    //     client.guilds.fetch(guildId).then(server => {
    //         return server.channels.cache.find(channel => channel.id == '814567886700937279');
    //     })
    //     .then(channel => {
    //         channel.send(
    //             'TotalComments/MemberComments: ' + chatAnalysis.totalChats + ' / ' + chatAnalysis.totalChatsByMembers + '\n' +
    //             'Members: ' + memberList.size + '\n' +
    //             'NotMembers: ' + notMemberList.size
    //         ,{ code: 'js' });
    //     });
    // }, 60000);
    
    ls.succeed('Start catching respones...');

    // Catch get_live_chat responses.
    page.on('response', async res => {
        const url = new URL(res.url());

        if (url.pathname != '/youtubei/v1/live_chat/get_live_chat') return;

        const json = await res.json();

        // Check if live chat stopped or not.
        if (!json.hasOwnProperty('continuationContents')) {
            await sleep(10000);
            console.log('Stream ended.\nRestart live stream check process.'.bgBlue);
            // clearInterval(logToDiscord);
            page.off('response');
            page.close();
            browser.close();

            if (config['analysisDataOnTextChannelId']) {
                client.channels.fetch(config['analysisDataOnTextChannelId'])
                    .then(channel => {
                        const ca = Object.assign(chatAnalysis, { memberList: memberList, notMemberList: notMemberList });
                        const embed = new MessageEmbed()
                            .setColor('#ff0000')
                            .setAuthor(channelName, channelIcon)
                            .setThumbnail(`https://i.ytimg.com/vi/${videoId}/hqdefault_live.jpg`)
                            .setTitle('直播統計資料') // live stream analysis data
                            .addFields([
                                { name: '總留言數', value: ca.totalChats, inline: true }, // total comment count
                                { name: '會員留言數', value: ca.totalChatsByMembers, inline: true },
                                { name: '會員比例', value: Math.floor((ca.totalChatsByMembers / ca.totalChats) * 100) + '%', inline: true } // member comment ratio
                            ])
                            .addFields([
                                { name: '參與總人數', value: ca.memberList.size + ca.notMemberList.size, inline: true },
                                { name: '參與會員數', value: ca.memberList.size, inline: true },
                                { name: '會員比例', value: Math.floor((ca.memberList.size / (ca.memberList.size + ca.notMemberList.size)) * 100) + '%', inline: true }
                            ])
                            

                        channel.send(embed);
                    })
            }

            return mainProcess();
        }

        // Check live chat currently using which type of continuation data.
        const liveChatContinuation = json['continuationContents']['liveChatContinuation'];
        let continuationTime = liveChatContinuation['continuations'][0];

        if (continuationTime.hasOwnProperty('invalidationContinuationData')) {
            continuationTime = continuationTime['invalidationContinuationData']['timeoutMs'];
        } else {
            continuationTime = continuationTime['timedContinuationData']['timeoutMs'];
        }

        if (!liveChatContinuation.hasOwnProperty('actions')) return;
        const chatItems = liveChatContinuation['actions'];

        // console.log(continuationTime);
        const delayBetweenChat = continuationTime / chatItems.length;

        for (const item of chatItems) {
            // if (!item.hasOwnProperty('addChatItemAction')) return;
            try {

                let isSuperChat = false;
                let isMemberItem = false;
                // Useless item after new member/super chat item.
                if (item.hasOwnProperty('addLiveChatTickerItemAction')) throw 'addTickerAction';
                // Deleted message
                if (item.hasOwnProperty('markChatItemAsDeletedAction')) throw 'deletedStateMessage';

                if (item.hasOwnProperty('markChatItemsByAuthorAsDeletedAction')) throw 'deletedStateMessage';

                if (item.hasOwnProperty('liveChatPlaceholderItemRenderer')) throw 'liveChatPlaceholder';

                const chatRenderer = item['addChatItemAction']['item'];
                
                if (chatRenderer.hasOwnProperty('liveChatPaidMessageRenderer')) isSuperChat = true;
                if (chatRenderer.hasOwnProperty('liveChatMembershipItemRenderer')) isMemberItem = true;

                let logMsg = null;
                if (!isMemberItem) {
                    const chat = chatRenderer[isSuperChat ? 'liveChatPaidMessageRenderer' : 'liveChatTextMessageRenderer'];
                    let msg = '';

                    if (Object.prototype.hasOwnProperty.call(chat, 'message')) {
                        chat['message']['runs'].forEach(element => {
                            if (element.hasOwnProperty('text')) msg += element.text
                            if (element.hasOwnProperty('emoji')) msg += element.emoji.shortcuts[0];
                        });
                    }

                    const newChat = {
                        authorName: chat['authorName']['simpleText'],
                        authorChannelId: chat['authorExternalChannelId'],
                        msg: msg,
                        isMember: chat.hasOwnProperty('authorBadges')
                    }

                    if (isSuperChat) {
                        newChat.money = chat['purchaseAmountText']['simpleText'];
                        newChat.bgColor = (() => {
                            switch (chat['headerBackgroundColor']) {
                                case 4279592384:
                                    return 'blue';
                                case 4278239141:
                                    return 'green';
                                case 4278237396:
                                    return 'cyan';
                                case 4291821568:
                                    return 'red';
                                case 4293284096:
                                    return 'orange';
                                case 4294947584:
                                    return 'yellow';
                                case 4290910299:
                                    return 'pink';
                            }
                        })()
                    }

                    if (newChat.isMember) {
                        if (!memberList.has(newChat.authorChannelId)) {
                            memberList.add(newChat.authorChannelId);

                            db.get(newChat.authorChannelId, async (err, value) => {
                                if (err) {
                                    if (err.notFound) {
                                        return;
                                    } else {
                                        throw err;
                                    }
                                }
                                // console.log('isGuildMember!'.bgMagenta);
                                showGuildMemberLog = true;
                                // const guildMemberDetail = value;
                                db.put(newChat.authorChannelId, Object.assign(value, {
                                    youtubeMember: {
                                        channelId: config['channelId'],
                                        active: true,
                                        lastUpdateAt: Date.now()
                                    }
                                }), err => {
                                    if (err) throw err;
                                });
                                client.guilds.fetch(guildId)
                                    .then(guild => {
                                        return guild.members.fetch(value.discordId);
                                    })
                                    .then(member => {
                                        if (member.roles.cache.has(config['roleId'])) {
                                            console.log((
                                                '['.black + '='.red +'] '.black +
                                                ('Detect guild member ' + value.username + ` (${value.discordId}) ` + 
                                                'already have role. Update last check time.').black
                                            ).bgWhite);
                                        } else {
                                            member.roles.add(config['roleId']);
                                            console.log((
                                                '['.black + '+'.red +'] '.black +
                                                ('Detect guild member ' + value.username + ` (${value.discordId}) ` + 
                                                'youtube id match. Give user role.').black
                                            ).bgWhite);
                                        }
                                    });
                                
                            });
                        }

                        chatAnalysis.totalChats += 1;
                        chatAnalysis.totalChatsByMembers += 1;
                    } else {
                        chatAnalysis.totalChats += 1;
                        notMemberList.add(newChat.authorChannelId);

                        await db.get(newChat.authorChannelId, (err, value) => {
                            if (err) {
                                if (err.notFound) {
                                    return;
                                } else {
                                    throw err;
                                }
                            }
                            if (!value.hasOwnProperty('youtubeMember')) return;
                            if (value.youtubeMember.active == true) showGuildMemberLog = true;
                            
                            db.put(newChat.authorChannelId, Object.assign(value, {
                                youtubeMember: {
                                    channelId: config['channelId'],
                                    active: false,
                                    lastUpdateAt: Date.now()
                                }
                            }), err => {
                                if (err) throw err;
                            });
                            client.guilds.fetch(guildId).then(guild => {
                                guild.members.fetch(value.discordId).then(member => {
                                    if (member.roles.cache.has(config['roleId'])) {
                                        member.roles.remove(config['roleId']);
                                        console.log((
                                            '['.black + '-'.red +'] '.black +
                                            ('Detect guild member ' + value.username + ` (${value.discordId}) ` + 
                                            `doesn't have membership anymore. Remove user role.`).black
                                        ).bgWhite)
                                                
                                    } else {
                                        return;
                                    }
                                });
                            });
                        })
                    }

                    // console.log(newChat);
                    const str = (isSuperChat ? (newChat.money + ' ') : '') + (newChat.isMember ? newChat.authorName.green : newChat.authorName)+ ': ' + newChat.msg;
                    logMsg = (() => {
                        if (!isSuperChat) return str;
                        switch (newChat.bgColor) {
                            case 'blue':
                                return str.bgBlue;
                            case 'green':
                                return str.bgGreen.black;
                            case 'cyan':
                                return str.bgCyan.black;
                            case 'yellow':
                                return str.bgYellow.black;
                            case 'orange':
                                const middle = str.length / 2;
                                return str.substr(0, middle).bgYellow.black + str.substr(middle + 1).bgRed;
                            case 'pink':
                                return str.bgMagenta;
                            case 'red':
                                return str.bgRed;
                        }   
                    })();

                } else {
                    const chat = chatRenderer['liveChatMembershipItemRenderer'];
                    const newMemberBadge = config['newMemberBadge'].split('=')[0];

                    const newChat = {
                        authorName: chat['authorName']['simpleText'],
                        authorChannelId: chat['authorExternalChannelId'],
                        memberDetail: chat['authorBadges'][0]['liveChatAuthorBadgeRenderer']['tooltip'],
                        isNewMember: chat['authorBadges'][0]['liveChatAuthorBadgeRenderer']['customThumbnail']['thumbnails'][0].startsWith(newMemberBadge)
                    }

                    logMsg = '[Member] ' + newChat.authorName + ' ' + newChat.memberDetail;

                    if (newChat.isNewMember) {
                        memberList.add(newChat.authorChannelId);
                    }

                    await db.get(newChat.authorChannelId, (err, value) => {
                        if (err) {
                            if (err.notFound) {
                                return;
                            } else {
                                throw err;
                            }
                        }
                        showGuildMemberLog = true;
                        if (newChat.isNewMember) {
                            console.log((
                                '['.black + '+'.red +'] '.black +
                                ('Detect guild member ' + value.username + ` (${value.discordId}) ` + 
                                'join membership! Give user role.').black
                            ).bgWhite);
                        } else {
                            console.log((
                                '['.black + '='.red +'] '.black +
                                ('Detect guild member ' + value.username + ` (${value.discordId}) ` + 
                                'member badge update. Updata last check time.').black
                            ).bgWhite);
                        }
                        db.put(newChat.authorChannelId, Object.assign(value, {
                            youtubeMember: {
                                channelId: config['channelId'],
                                active: true,
                                lastUpdateAt: Date.now()
                            }
                        }), err => {
                            if (err) throw err;
                        });
                    })

                    
                }
                
                console.log(
                    (isMemberItem ? logMsg.bgGreen.black : logMsg)
                    
                );
                
            } catch(err) {
                if (err != 'addTickerAction' && err != 'deletedStateMessage' && err != 'liveChatPlaceholder') {
                    console.log(err, item);
                }
            } finally {
                await sleep(delayBetweenChat);
            }
        }

    });

}

async function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}

let userTokenCount = 0;
function switchUserToken() {
    if (userTokenCount < config['user_token'].length) {
        userTokenCount++;
    } else {
        userTokenCount = 0;
    }

    userToken == config['user_token'][userTokenCount];
}

client.login(config['bot_token']);