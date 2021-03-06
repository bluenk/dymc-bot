// const level = require('level');
// const db = level('./db', { valueEncoding: 'json' });

// db.get('UC0L7m3v3ClVcWcrXks2xL-Q', (err, value) => {
//     if (err) {
//         if (err.notFound) {
//             return;
//         } else {
//             throw err;
//         }
//     }
//     db.put('UC0L7m3v3ClVcWcrXks2xL-Q', Object.assign(value, {
//         youtubeMembers: {
//             channelId: config['channelId'],
//             active: true,
//             lastUpdateAt: Date.now()
//         }
//     }), err => {
//         throw err;
//     })
// })

// db.createReadStream()
//         .on('data', data => {
//             // console.log(data);
//             if (data.key == 'UC0L7m3v3ClVcWcrXks2xL-Q') {
//                 console.log(data.value);
//             }
//         })

// if ("") {
//     console.log('return true');
// } else {
//     console.log('return false');
// }

const colors = require('colors');
console.log((
    '['.black + '+'.magenta +'] '.black +
    'Detect guild member '.black + 'ASFA'.blue + ' ('.black + '46549874986541'.green + ') '.black + 
    'youtube id match. Give user role.'.black
).bgWhite)