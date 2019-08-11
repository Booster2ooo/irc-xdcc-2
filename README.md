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
    progressInterval: 1 // [Number(int)] Interval (in seconds) for the progress update event (xdcc-progress) -- Default: 1
  , destPath: '/path/to/destination' // [String] The destination path for downloads -- Default: module lib path + /downloads -> path.join(__dirname, 'downloads')
  , resume: true // [Boolean] Allow download to be resumed -- Default: true
  , acceptUnpooled: false // [Boolean] Accept unrequested DCC download (accept a DCC download that doesn't match any DCC instance found in _transfer pool array -- Default: false
  , closeConnectionOnDisconnect: true // [Boolean] Defines if active sockets should be closed if the IRC client get disconnected or killed -- Default: true
  , method: 'say' // [String] Defines the method to trigger xdcc bots, either 'say' or 'ctcp' (you can also use 'msg' which is equivalent to 'say') -- Default: 'say'
  , sendCommand: 'XDCC SEND' // [String] the command sent to the bot to initiate the xdcc transfert -- Default: 'XDCC SEND'
  , cancelCommand: 'XDCC CANCEL' // [String] the command sent to the bot to cancel the xdcc transfert -- Default: 'XDCC CANCEL'
  , removeCommand: 'XDCC REMOVE' // [String] the command sent to the bot to cancel a queued transfert -- Default: 'XDCC REMOVE'
  , joinTopicChans: true // [Boolean] automatically rejoin channels mentioned in the topic -- Default: true
  , queuedParser:  /queue for pack #?(\d+) \("(\.+)"\) in position/ // [RegExp] regexp to parse queue notices/messages -- Default:  /queue for pack #?(\d+) \("(\.+)"\) in position/
  , sendParser: /sending( you)?( queued)? pack #?(\d+) \("(.+)"\)/i // [RegExp] regexp to parse send notices/messages -- Default:  /sending( you)?( queued)? pack #?(\d+) \("(.+)"\)/i
}
```


## Constructor
Instead of using the new irc.Client() method as a construtor, the irc-xdcc module provides a promise wrapper:

```javascript
const client = new ircXdcc.XdccClient(server, nick, options);
```

Sample:
```javascript
// load irc-xdcc module
const ircXdcc = require('irc-xdcc-2')
// set options object
const ircOptions = {
    userName: 'ircClient'
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
  , closeConnectionOnDisconnect: false
};
// launch the client
const client = ircXdcc('irc.myserver.com', 'myBotNick', ircOptions);
// listen for events and do things
client.addListener('registered', () => { console.log('bot connected'); });
client.addListener('connected', () => { 
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


## Methods
irc-xdcc module extends irc.Client methods with a set of promises:

**addTransfer(packInfo)**

Add a transfer to the pool and starts xdcc transfer for the provided pack infos (e.g.: { botNick: 'xdccBot', packId: 1 } ) where botNick is the xdcc server bot nick and packId, the required pack id.

```javascript
botInstance.addTransfer({ botNick: 'xdccBot', packId: '1'})
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
botInstance.cancelTransfer(transfer)
    .then(() => {})
    .catch(() => {
        console.error(err);
    });
```

**cancelTransferByInfo(packInfo)**

Cancel DCC transfer instances matching packInfo ({ botNick: 'xdccBot', packId: 1 }).

```javascript
botInstance.cancelTransferByInfo({ botNick: 'xdccBot', packId: '1'})
    .then(() =>
    .catch(() => {
        console.error(err);
    });
```

**cancelTransferById(poolId)**

Cancel DCC transfer for the specified transfer ID (transfer.transferId).

```javascript
botInstance.cancelTransferById(2)
    .then(() =>
    .catch(() => {
        console.error(err);
    });
```

**listTransfers()**

Returns the transfer pool (where transfers are stored).

```javascript
botInstance.listTransfers()
    .then(() =>
    .catch(() => {
        console.error(err);
    });
```

**removeTransfer(transfer)**

Cancel xdcc transfer and remove transfer from pool.

```javascript
botInstance.removeTransfer(transfer)
    .then(() =>
    .catch(() => {
        console.error(err);
    });
```

**removeTransferById(poolId)**

Cancel xdcc transfer and remove transfer from pool using its id.

```javascript
botInstance.removeTransferById(1)
    .then(() =>
    .catch(() => {
        console.error(err);
    });
```

**start(transfer)**

Sends the start signal to the server bot for the specified transfer.

```javascript
botInstance.start(transfer)
    .then(() =>
    .catch(() => {
        console.error(err);
    });
```

**cancel(transfer)**

Sends the cancel signal to server bot for the specified transfer.

```javascript
botInstance.start(transfer)
    .then(() =>
    .catch(() => {
        console.error(err);
    });
```


## Events
Along with extending irc module option and methods, some events have been added too:

**'connected'**
```
() => {}
```
Event fired when the irc client is connected and joined all channels specified in the options

**'xdcc-error'**
```
(error) => {}
```
Event fired when a method call is erroneous

**'xdcc-created'**
```
(transfer) => {}
```
Fired when a DCC instance has been created (and added to the transfer pool) (see misc. section for transfer info)

**'xdcc-requested'**
```
(transfer) => {}
```
Fired when a DCC pack has been requested to the bot (see misc. section for transfer info)

**'xdcc-removed'**
```
(transfer) => {}
```
Fired when a DCC instance has been removed from transfer pool (see misc. section for transfer info)

**'xdcc-started'**
```
(transfer) => {}
```
Fired when the XDCC SEND command has been sent (see misc. section for transfer info)

**'xdcc-queued'**
```
(transfer) => {}
```
Fired when a queue notice has been recieved from the server (see misc. section for transfer info)

**'xdcc-complete'**
```
(transfer) => {}
```
Fired when a DCC transfer has been completed (see misc. section for transfer info)

**'xdcc-canceled'**
```
(transfer) => {}
```
Fired when a DCC transfer has been canceled (see misc. section for transfer info)

**'xdcc-connect'**
```
(transfer) => {}
```
Fired when a DCC transfer starts (see misc. section for transfer info)

**'xdcc-progress'**
```
(transfer) => {}
```
Fired every *option.progressInterval* seconds during DCC transfer providing the *received* bytes

**'xdcc-dlerror'**
```
(transfer) => {}
```
Fired when a DCC transfer encounter an error


## XDCC transfer
An XDCC transfer is an object containing pieces of information regarding a specific xdcc transfer.

**xdccInfo**
```javascript
{
    botNick // xdcc server bot nick
  , packId // xdcc pack id
  , server // irc server
  , state // state of the transfer
  , canceled // true if an error occured and the cancel/remove command has been send to the server
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


## Thanks

- [Indysama](https://github.com/Indysama) for [node-xdcc](https://github.com/Indysama/node-xdcc)
- [DaVarga](https://github.com/DaVarga) for  [node-axdcc](https://github.com/DaVarga/node-axdcc/)