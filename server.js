/*
	References: http://adamputinski.com/blog/2012/10/sending-ios-push-notifications-with-nodejs/
		http://www.raywenderlich.com/32960/apple-push-notification-services-in-ios-6-tutorial-part-1
*/
var fs = require('fs'),
	crypto = require('crypto'),
    tls = require('tls'),
    certPem = fs.readFileSync('apns-prod-cert.pem', encoding='ascii'),
    keyPem = fs.readFileSync('apns-prod-key-noenc.pem', encoding='ascii'),
    caCert = fs.readFileSync(__dirname + '/ApplePush.cer', encoding='ascii'),
    options = { key: keyPem, cert: certPem, ca: [ caCert ] },
    http = require('http');

var tokens = {
	// matt3141:
	"189713730": '3c6a0ee1 90ace695 35f8e66b e40b7359 da791e46 ecbe1bbc d0b70b5e ad631002'.replace(/\s/g,''),
	// omniverse:
	"386867113": '030b8965 f222b0d4 6e3ccb5a 6b6bdd91 e72f07b3 92006818 0ceb1d06 96036f41'.replace(/\s/g,'')
};

function hextobin(hexstr) {
    var buf = new Buffer(hexstr.length / 2);
    for(var i = 0; i < hexstr.length/2 ; i++) {
        buf[i] = (parseInt(hexstr[i * 2], 16) << 4) + (parseInt(hexstr[i * 2 + 1], 16));
    }
    return buf;
 }
function connectAPN( user, from, message, next ) {
    var stream = tls.connect(2195, 'gateway.sandbox.push.apple.com', options, function() {
        // connected
        console.log("sent", user);
        next( !stream.authorized, stream );
    });

    var pushnd = { aps: { alert: message }, customParam: { from: from } } // 'aps' is required
        , hextoken = tokens[user] // Push token from iPhone app. 32 bytes as hexadecimal string
        , token = hextobin(hextoken)
        , payload = JSON.stringify(pushnd)
        , payloadlen = Buffer.byteLength(payload, 'utf-8')
        , tokenlen = 32
        , buffer = new Buffer(1 +  4 + 4 + 2 + tokenlen + 2 + payloadlen)
        , i = 0
        , msgid = 0xbeefcace // message identifier, can be left 0
        , seconds = Math.round(new Date().getTime() / 1000) + 1*60*60 // expiry in epoch seconds (1 hour)
        , payload = JSON.stringify(pushnd);

    buffer[i++] = 1; // command
    buffer[i++] = msgid >> 24 & 0xFF;
    buffer[i++] = msgid >> 16 & 0xFF;
    buffer[i++] = msgid >> 8 & 0xFF;
    buffer[i++] = msgid & 0xFF;

    // expiry in epoch seconds (1 hour)
    buffer[i++] = seconds >> 24 & 0xFF;
    buffer[i++] = seconds >> 16 & 0xFF;
    buffer[i++] = seconds >> 8 & 0xFF;
    buffer[i++] = seconds & 0xFF;

    buffer[i++] = tokenlen >> 8 & 0xFF; // token length
    buffer[i++] = tokenlen & 0xFF;
    token = hextobin(hextoken);
    token.copy(buffer, i, 0, tokenlen)
    i += tokenlen;
    buffer[i++] = payloadlen >> 8 & 0xFF; // payload length
    buffer[i++] = payloadlen & 0xFF;

    payload = Buffer(payload);
    payload.copy(buffer, i, 0, payloadlen);
    stream.write(buffer);  // write push notification

    stream.on('data', function(data) {

        var command = data[0] & 0x0FF  // always 8
            , status = data[1] & 0x0FF  // error code
            , msgid = (data[2] << 24) + (data[3] << 16) + (data[4] << 8 ) + (data[5]);
        console.log(command + ':' + status + ':' + msgid);
    });

};

exports.module = http.createServer(function(req, res) {
	if( req.url.match(/\/message\/[^\/]+\/[^\/]+/) ) {
		var buffer = [];
		req.on("data", function(chunk) {
			buffer.push(chunk);
		});
		req.on("end", function() {
			var to = req.url.substr(1).split('/')[1],
				from = req.url.substr(1).split('/')[2];
			connectAPN(to, from, buffer.join(""), function() {
				res.end("sent\n");
			});			
		});
	} else {
		res.end("404");
	}
});