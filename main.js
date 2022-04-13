'use strict';

var usernamePage = document.querySelector('#username-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var opForm=document.querySelector('#opForm');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var connectingElement = document.querySelector('.connecting');

var stompClient = null;
var username = null;
var sessionId = null;
var localTS = 0;
var remoteTS = 0;
var localOp = null;
var remoteOp = null;
var localOpPrime = null;
var remoteOpPrime = null;
var opBuffer = new Array();
var CtoS_Msg = null;
var StoC_Msg = null;

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

class Op {
    constructor(sessionId, type, parentId, index, content){
        this.uid = sessionId;
        this.type = type;
        this.parentId = parentId;
        this.index = index;
        this.content = content;
    }
}
const ClientStateEnum = {"Synced":1, "AwaitingACK":2, "AwaitingWithBuffer":3, "ApplyingRemoteOp":4, "ApplyingLocalOp":5, "ApplyingRemoteOpWithoutACK":6, "ApplyingBufferedLocalOp":7, "CreatingLocalOpFromBuffer":8, "ApplyingRemoteOpWithBuffer":9, "SendingOpToController":10}
Object.freeze(ClientState);

var ClientState=null;

let ws = new WebSocket("ws://127.0.0.1:8080/websocket");

    console.log(ws);
    ws.open = () => {
        console.log('open connect!');
    }

function connect(event) {
    

}

function send(){}

usernameForm.addEventListener('submit', connect, true)
//messageForm.addEventListener('submit', send, true)
opForm.addEventListener('submit', send, true)
