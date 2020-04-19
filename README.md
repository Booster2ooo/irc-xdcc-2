# irc-xdcc-2

## Disclamer
This module does not intend to facilitate illegal files transfer. The author may not be taken responsible for any copyright infringement or illegal uses.


## Introduction
irc-xdcc-2 is a [node-irc module](https://github.com/martynsmith/node-irc) promises based extension providing xdcc handlers with Typescript support.

It's a recode of [irc-xdcc](https://github.com/Booster2ooo/irc-xdcc) which is basically a recode of Indysama [node-xdcc](https://github.com/Indysama/node-xdcc) / DaVarga [node-axdcc](https://github.com/DaVarga/node-axdcc/).


## Options
irc-xdcc-2 provide an extension of the irc module. It extends the [available options](https://node-irc.readthedocs.org/en/latest/API.html#client) with the following:

```javascript
{
    server: 'irc.server.org'
  , nick: 'myCoolNick'
  , progressInterval: 1 // [Number(int)] Interval (in seconds) for the progress update event (xdcc-progress) -- Default: 1
  , destPath: '/path/to/destination' // [String] The destination path for downloads -- Default: module lib path + /downloads -> path.join(__dirname, 'downloads')
  , resume: true // [Boolean] Allow download to be resumed -- Default: true
  , acceptUnpooled: false // [Boolean] Accept unrequested DCC download (accept a DCC download that doesn't match any DCC instance found in _transfer pool array -- Default: false
  , closeConnectionOnCompleted: true // [Boolean] Defines if active sockets should be closed if the IRC client get disconnected or killed -- Default: true
  , method: 'say' // [String] Defines the method to trigger xdcc bots, either 'say' or 'ctcp' (you can also use 'msg' which is equivalent to 'say') -- Default: 'say'
  , sendCommand: 'XDCC SEND' // [String] the command sent to the bot to initiate the xdcc transfert -- Default: 'XDCC SEND'
  , cancelCommand: 'XDCC CANCEL' // [String] the command sent to the bot to cancel the xdcc transfert -- Default: 'XDCC CANCEL'
  , removeCommand: 'XDCC REMOVE' // [String] the command sent to the bot to cancel a queued transfert -- Default: 'XDCC REMOVE'
  , joinTopicChans: true // [Boolean] automatically rejoin channels mentioned in the topic -- Default: true
  , queuedParser:  /queue for pack #?(\d+) \("(.+)"\) in position/ // [RegExp] regexp to parse queue notices/messages -- Default:  /queue for pack #?(\d+) \("(.+)"\) in position/
  , sendParser: /sending( you)?( queued)? pack #?(\d+) \("(.+)"\)/i // [RegExp] regexp to parse send notices/messages -- Default:  /sending( you)?( queued)? pack #?(\d+) \("(.+)"\)/i
}
```


## Constructor (legacy)
Instead of using the new irc.Client(), use XdccClient. Server and nick arguments moved to options:

```javascript
const { XdccClient } = require('irc-xdcc-2');
const options = { /* ... */ };
const client = new XdccClient(options);
```

Sample:
```javascript
// load irc-xdcc module
const { XdccClient, XdccEvents } = require('irc-xdcc-2')
// set options object
const ircOptions = {
    server: 'irc.myserver.com'
  , nick: 'myBotNick'
  , userName: 'ircClient'
  , realName: 'irc Client'
  , port: 6697
  , autoRejoin: true
  , autoConnect: true
  , channels: [ '#xdcc', '#xdcc-chat' ]
  , secure: true
  , selfSigned: true
  , certExpired: true
  , stripColors: true
  , encoding: 'UTF-8'
  // xdcc specific options
  , progressInterval: 5
  , destPath: './dls'
  , resume: false
  , acceptUnpooled: true
  , closeConnectionOnCompleted: false
};
// launch the client
const client = new XdccClient(ircOptions);
// listen for events and act
client.addListener(XdccEvents.ircRegistered, () => { console.log('bot registered'); });
client.addListener(XdccEvents.ircConnected, () => { 
    client.addTransfer({ botNick: 'xdccBot', packId: '123'})
        .then((transfer) => {})
        .catch((err) => {
            if(err.code) {
                console.error('Error ' + err.code + ': ' +  err.message);
            }
            else {
                console.error(err);
            }
        });    
});
```

## Factory (promise based)
Alternatively to the constructor, XdccClient also exposes a static factory to create a new instance. The factory method returns a promise that resolves the new instance either directly after creation if autoConnect is false or after the 'connected' event if autoConnect is true.

```javascript
const { XdccClient } = require('irc-xdcc-2');
const options = { /* ... */ };
XdccClient.create(options)
    .then(client => {})
    .catch(err => console.error(err))
    ;
```

Sample:
```javascript
// load irc-xdcc module
const { XdccClient, XdccEvents } = require('irc-xdcc-2')
// set options object
const ircOptions = {
    server: 'irc.myserver.com'
  , nick: 'myBotNick'
  , userName: 'ircClient'
  , realName: 'irc Client'
  , port: 6697
  , autoRejoin: true
  , autoConnect: true
  , channels: [ '#xdcc', '#xdcc-chat' ]
  , secure: true
  , selfSigned: true
  , certExpired: true
  , stripColors: true
  , encoding: 'UTF-8'
  // xdcc specific options
  , progressInterval: 5
  , destPath: './dls'
  , resume: false
  , acceptUnpooled: true
  , closeConnectionOnCompleted: false
};
// launch the client
XdccClient.create(options)
    .then(client => {
        // listen for events and act
        client.addListener(XdccEvents.ircRegistered, () => { console.log('bot registered'); });
        client.addListener(XdccEvents.ircConnected, () => { 
            client.addTransfer({ botNick: 'xdccBot', packId: '123'})
                .then((transfer) => {})
                .catch((err) => {
                    if(err.code) {
                        console.error('Error ' + err.code + ': ' +  err.message);
                    }
                    else {
                        console.error(err);
                    }
                });    
        });
    })
    .catch(console.error.bind(console))
    ;
```


## Methods
irc-xdcc module extends irc.Client methods with a set of promises:

**connectP(retryCount)**

Promise based alternative to the native connect() method.

```javascript
client.connectP()
    .then()
    .catch(console.error.bind(console))
    ;
```

**addTransfer(packInfo)**

Add a transfer to the pool and starts xdcc transfer for the provided pack infos (e.g.: { botNick: 'xdccBot', packId: 1 } ) where botNick is the xdcc server bot nick and packId, the required pack id.

```javascript
client.addTransfer({ botNick: 'xdccBot', packId: '1'})
    .then((transfer) => {})
    .catch((err) => {
        if(err.code) {
            console.error('Error ' + err.code + ': ' +  err.message);
        }
        else {
            console.error(err);
        }
    });
```

**cancelTransfer(transfer)**

Cancel DCC transfer.

```javascript
client.cancelTransfer(transfer)
    .then(() => {})
    .catch(console.error.bind(console))
    ;
```

**cancelTransferByInfo(packInfo)**

Cancel DCC transfer instances matching packInfo ({ botNick: 'xdccBot', packId: 1 }).

```javascript
client.cancelTransferByInfo({ botNick: 'xdccBot', packId: '1'})
    .then(() => {})
    .catch(console.error.bind(console))
    ;
```

**cancelTransferById(poolId)**

Cancel DCC transfer for the specified transfer ID (transfer.transferId).

```javascript
client.cancelTransferById(2)
    .then(() => {})
    .catch(console.error.bind(console))
    ;
```

**listTransfers()**

Returns the transfer pool (where transfers are stored).

```javascript
client.listTransfers()
    .then(() => {})
    .catch(console.error.bind(console))
    ;
```

**removeTransfer(transfer)**

Cancel xdcc transfer and remove transfer from pool.

```javascript
client.removeTransfer(transfer)
    .then(() => {})
    .catch(console.error.bind(console))
    ;
```

**removeTransferById(poolId)**

Cancel xdcc transfer and remove transfer from pool using its id.

```javascript
client.removeTransferById(1)
    .then(() => {})
    .catch(console.error.bind(console))
    ;
```

**start(transfer)**

Sends the start signal to the server bot for the specified transfer.

```javascript
client.start(transfer)
    .then(() => {})
    .catch(console.error.bind(console))
    ;
```

**cancel(transfer)**

Sends the cancel signal to server bot for the specified transfer.

```javascript
client.start(transfer)
    .then(() => {})
    .catch(console.error.bind(console))
    ;
```


## Events
Along with extending irc module option and methods, some events have been added too:

**XdccEvents.ircConnected | 'connected'**
```
() => {}
```
Event fired when the irc client is connected and joined all channels specified in the options

**XdccEvents.xdccError | 'xdcc-error'**
```
(error) => {}
```
Event fired when a method call is erroneous

**XdccEvents.xdccCreated | 'xdcc-created'**
```
(transfer) => {}
```
Fired when a DCC instance has been created (and added to the transfer pool) (see [transfer info](#xdcc-transfer))

**XdccEvents.xdccRequested | 'xdcc-requested'**
```
(transfer) => {}
```
Fired when the XDCC SEND command has been sent (see [transfer info](#xdcc-transfer))

**XdccEvents.xdccRemoved | 'xdcc-removed'**
```
(transfer) => {}
```
Fired when a DCC instance has been removed from transfer pool (see [transfer info](#xdcc-transfer))

**XdccEvents.xdccStarted | 'xdcc-started'**
```
(transfer) => {}
```
Fired when the file transfer begins (see [transfer info](#xdcc-transfer))

**XdccEvents.xdccQueued | 'xdcc-queued'**
```
(transfer) => {}
```
Fired when a queue notice has been recieved from the server (see [transfer info](#xdcc-transfer))

**XdccEvents.xdccCompleted | 'xdcc-completed'**
```
(transfer) => {}
```
Fired when a DCC transfer has been completed (see [transfer info](#xdcc-transfer))

**XdccEvents.xdccCanceled | 'xdcc-canceled'**
```
(transfer) => {}
```
Fired when a DCC transfer has been canceled (see [transfer info](#xdcc-transfer))

**XdccEvents.xdccConnected | 'xdcc-connected'**
```
(transfer) => {}
```
Fired when a DCC transfer starts (see [transfer info](#xdcc-transfer))

**XdccEvents.xdccProgressed | 'xdcc-progressed'**
```
(transfer) => {}
```
Fired every *option.progressInterval* seconds during DCC transfer providing the *received* bytes (see [transfer info](#xdcc-transfer))

**XdccEvents.xdccDlError | 'xdcc-dlerror'**
```
(transfer) => {}
```
Fired when a DCC transfer encounter an error (see [transfer info](#xdcc-transfer))

**XdccEvents**
```javascript
{
    xdccError:              'xdcc-error',
    xdccCreated:            'xdcc-created',
    xdccRequested:          'xdcc-requested',
    xdccStarted:            'xdcc-started',
    xdccRemoved:            'xdcc-removed',
    xdccQueued:             'xdcc-queued',
    xdccCompleted:          'xdcc-completed',
    xdccCanceled:           'xdcc-canceled',
    xdccConnected:          'xdcc-connected',
    xdccProgressed:         'xdcc-progressed',
    xdccDlError:            'xdcc-dlerror',
    ircNotice:              'notice',
    ircError:               'error',
    ircQuit:                'quit',
    ircKill:                'kill',
    ircRegistered:          'registered',
    ircJoin:                'join',
    ircConnected:           'connected',
    ircMotd:                'motd',
    ircNames:               'names',
    ircTopic:               'topic',
    ircPart:                'part',
    ircKick:                'kick',
    ircMessage:             'message',
    ircSelfMessage:         'selfMessage',
    ircPing:                'ping',
    ircPm:                  'pm',
    ircCtcp:                'ctcp',
    ircCtcpPrivmsg:         'ctcp-privmsg',
    ircCtcpVersion:         'ctcp-version',
    ircCtcpNotice:          'ctcp-notice',
    ircNick:                'nick',
    ircInvite:              'invite',
    ircModeAdd:             '+mode',
    ircModeRemove:          '-mode',
    ircWhois:               'whois',
    ircChannellistStart:    'channellist_start',
    ircChannellistItem:     'channellist_item',
    ircChannellist:         'channellist',
    ircRaw:                 'raw',
    ircAction:              'action',
    ircClose:               'close',
    ircNeterror:            'netError',
    ircAbort:               'abort',
    ircPong:                'pong',
    ircOpered:              'opered',
    ircConnect:             'connect'
}
```


## XDCC transfer
An XDCC transfer is an object containing pieces of information regarding a specific xdcc transfer.

**XdccTransfer**
```javascript
{
    botNick // xdcc server bot nick
  , packId // xdcc pack id
  , server // irc server
  , channel // irc channel
  , state // state of the transfer (see below)
  , transferId // id of the instance in the internal transfer pool
  , resumePosition // used to store resume position when an incomplete file is found in the destPath
  , receivedBytes // number of bytes received
  , progress // transfer progression percentage
  , speed // average transfer speed (bytes per second)
  , startedAt // process.hrtime() value when the download has been started
  , duration // process.hrtime(startedAt) value when the download has been completed
  , progressIntervalId // progress event setInterval id 
  , fileName // xdcc file name
  , lastCommand: // last xdcc command recieved from the server (SEND or ACCEPT)
  , ip: // server's ip address
  , port // server's socket port
  , fileSize: // xdcc file size
  , location: // file destination
  , sender // ctcp message emitter (= botNick)
  , target // ctcp message target (= ircClient nick)
  , message // ctcp message
  , params // ctcp parsed parts
  , error // error message/infos
}
```
**XdccTransferState**
```javascript
{
    canceled = -1,
    pending = 0,
    requested = 1,
    queued = 2,
    started = 3,
    completed = 4
}
```

## Thanks

- [Indysama](https://github.com/Indysama) for [node-xdcc](https://github.com/Indysama/node-xdcc)
- [DaVarga](https://github.com/DaVarga) for  [node-axdcc](https://github.com/DaVarga/node-axdcc/)