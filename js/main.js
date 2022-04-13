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

function connect(event) {
    username = document.querySelector('#name').value.trim();

    if(username) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        var socket = new SockJS('https://clot-ws.herokuapp.com/websocket');
        stompClient = Stomp.over(socket);
        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();

}


function onConnected() {
    // Subscribe to the Public Topic
    stompClient.subscribe('/topic/public', onMessageReceived);
    //console.log("session id: ", sessionId);
    stompClient.subscribe('/user/' + username + '/msg', onMessageReceived);

    // Tell your username to the server
    stompClient.send("/app/chat.register",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    )

    connectingElement.classList.add('hidden');
    ClientState=ClientStateEnum.Synced;
    console.log('state: Synced');
}


function onError(error) {
    connectingElement.textContent = 'Could not connect to WebSocket! Please refresh the page and try again or contact your administrator.';
    connectingElement.style.color = 'red';
}

function applyOp(op){
    let newNode;
    let newTextNode;
    let nodeOfClient;
    let children;
    let parentId = op.parentId;
    let space = "";

    if (op.type === 'INSERT') {
        //create new node
        for(let i = 0; i <= parentId.length; i++) space += "&emsp;"
        newNode = document.createElement('div');
        //newTextNode = document.createTextNode(op.content);
        newNode.innerHTML = space + op.content;
        //newNode.appendChild(newTextNode);
        //apply locally
        nodeOfClient = document.getElementById(op.parentId);
        if(nodeOfClient)
            if(nodeOfClient.children.length > op.index)
                nodeOfClient.insertBefore(newNode, nodeOfClient.children[op.index]);
    }
    else if (op.type === 'DELETE') {
        //save origin content
        nodeOfClient = document.getElementById(op.parentId);
        if(nodeOfClient)
            if(nodeOfClient.hasChildNodes())
                if(nodeOfClient.children.length > op.index)
                    nodeOfClient.removeChild(nodeOfClient.children[op.index]);

    }
    else if (op.type === 'EDIT'){
        //save origin content
        nodeOfClient = document.getElementById(op.parentId);
        children = nodeOfClient.children;
        children[op.index].innerHTML = op.content;
    }
    else{
        return;
    }
}

function OT(tarOp, refOp){
    let tarType = tarOp.type;
    let refType = refOp.type;
    let tarOpPrime;
    if(tarType === 'INSERT'){
        if(refType === 'INSERT'){
            tarOpPrime = TII(tarOp, refOp); // get A'
        }
        else if(refType === 'DELETE'){
            tarOpPrime = TID(tarOp, refOp); // get A'
        }
        else if(refType === 'EDIT'){
            tarOpPrime = TIE(tarOp, refOp); // get A'
        }
        else if(refType === 'FOCUS'){
            tarOpPrime = TIF(tarOp, refOp); // get A'
        }
        else if(refType === 'NULL'){
            tarOpPrime = tarOp;
        }
    }
    else if(tarType === 'DELETE'){
        if(refType === 'INSERT'){
            tarOpPrime = TDI(tarOp, refOp); // get A'
        }
        else if(refType === 'DELETE'){
            tarOpPrime = TDD(tarOp, refOp); // get A'
        }
        else if(refType === 'EDIT'){
            tarOpPrime = TDE(tarOp, refOp); // get A'
        }
        else if(refType === 'FOCUS'){
            tarOpPrime = TDF(tarOp, refOp); // get A'
        }
        else if(refType === 'NULL'){
            tarOpPrime = tarOp;
        }
    }
    else if(tarType === 'EDIT'){
        if(refType === 'INSERT'){
            tarOpPrime = TEI(tarOp, refOp); // get A'
        }
        else if(refType === 'DELETE'){
            tarOpPrime = TED(tarOp, refOp); // get A'
        }
        else if(refType === 'EDIT'){
            tarOpPrime = TEE(tarOp, refOp); // get A'
        }
        else if(refType === 'FOCUS'){
            tarOpPrime = TEF(tarOp, refOp); // get A'
        }
        else if(refType === 'NULL'){
            tarOpPrime = tarOp;
        }
    }
    else if(tarType === 'FOCUS'){
        if(refType === 'INSERT'){
            tarOpPrime = TFI(tarOp, refOp); // get A'
        }
        else if(refType === 'DELETE'){
            tarOpPrime = TFD(tarOp, refOp); // get A'
        }
        else if(refType === 'EDIT'){
            tarOpPrime = TFE(tarOp, refOp); // get A'
        }
        else if(refType === 'FOCUS'){
            tarOpPrime = TFF(tarOp, refOp); // get A'
        }
        else if(refType === 'NULL'){
            tarOpPrime = tarOp;
        }
    }
    else if(tarType === 'NULL'){
        tarOpPrime = tarOp;
    }
    return tarOpPrime
}

async function send(event) {
    // get Op info
    let type = document.getElementById("op").value;
    let parentId = document.getElementById("parent").value;
    let index = parseInt(document.getElementById("index").value);
    let content = document.getElementById("content").value;
    let tempOp =  new Op(sessionId, type, parentId, index, content);

    // ---------------------- state: Synced --------------------
    if(ClientState == ClientStateEnum.Synced) {
        /***** ApplyingLocalOp *****/
        ClientState = ClientStateEnum.ApplyingLocalOp;
        console.log('state: ApplyingLocalOp');
        await ApplyingLocalOp(tempOp);
    }
    // ---------------------- state: AwaitingACK or AwaitingWithBuffer --------------------
    else if(ClientState == ClientStateEnum.AwaitingACK || ClientState == ClientStateEnum.AwaitingWithBuffer){
        /***** ApplyingBufferedLocalOp *****/
        ClientState = ClientStateEnum.ApplyingBufferedLocalOp;
        console.log('state: ApplyingBufferedLocalOp');
        await ApplyingBufferedLocalOp(tempOp);
    }
    //-------------------------- State: Others ------------------------------
    else{
        if(ClientState != ClientStateEnum.Synced && ClientState != ClientStateEnum.AwaitingACK && ClientState != ClientStateEnum.AwaitingWithBuffer){
            send(event);
        }
    }
    event.preventDefault();
}

async function onMessageReceived(payload) {

    let StoC_msg = JSON.parse(payload.body);
    var messageElement = document.createElement('li');

    // join msg
    if(StoC_msg.type === 'JOIN') {
        /*if(StoC_msg.sender === username){
            sessionId = StoC_msg.sessionId;
            stompClient.subscribe('/user/' + sessionId + '/msg', onMessageReceived);
        }*/
        messageElement.classList.add('event-message');
        StoC_msg.content = StoC_msg.sender + ' joined!';
    }

    // leave msg
    else if (StoC_msg.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        StoC_msg.content = StoC_msg.sender + ' left!';
    }

    // ACK
    else if (StoC_msg.type === 'ACK') {
        //-------------------------- State: AwaitingACK ------------------------------
        if(ClientState == ClientStateEnum.AwaitingACK){
            ClientState = ClientStateEnum.Synced;
            console.log("state: Synced");
        }
        //-------------------------- State: AwaitingWithBuffer ------------------------------
        else if(ClientState == ClientStateEnum.AwaitingWithBuffer){
            /***** CreatingLocalOpFromBuffer *****/
            ClientState = ClientStateEnum.CreatingLocalOpFromBuffer;
            console.log('state: CreatingLocalOpFromBuffer');
            await CreatingLocalOpFromBuffer();
        }
        //-------------------------- State: Others ------------------------------
        else{
            if(ClientState != ClientStateEnum.AwaitingACK && ClientState != ClientStateEnum.AwaitingWithBuffer){
                onMessageReceived(payload);
            }
        }
    }

    // Op msg
    else {
        //--------------------------- State: Synced -----------------------------
        if (ClientState==ClientStateEnum.Synced){
            /***** ApplyRemoteOp *****/
            ClientState = ClientStateEnum.ApplyingRemoteOp;
            console.log('state: ApplyingRemoteOp');
            await ApplyingRemoteOp(StoC_msg);
        }
        //-------------------------- State: AwaitingACK ------------------------------
        else if(ClientState == ClientStateEnum.AwaitingACK){
            /***** ApplyingRemoteOpWithoutACK *****/
            ClientState = ClientStateEnum.ApplyingRemoteOpWithoutACK;
            console.log('state: ApplyingRemoteOpWithoutACK');
            await ApplyingRemoteOpWithoutACK(StoC_msg);
        }
        //-------------------------- State: AwaitingWithBuffer ------------------------------
        else if(ClientState == ClientStateEnum.AwaitingWithBuffer){
            /***** ApplyingRemoteOpWithBuffer *****/
            ClientState = ClientStateEnum.ApplyingRemoteOpWithBuffer;
            console.log('state: ApplyingRemoteOpWithBuffer');
            await ApplyingRemoteOpWithBuffer(StoC_msg);
        }
        //-------------------------- State: Others ------------------------------
        else{
            if(ClientState != ClientStateEnum.Synced && ClientState != ClientStateEnum.AwaitingACK && ClientState != ClientStateEnum.AwaitingWithBuffer){
                onMessageReceived(payload);
            }
        }


    }

    // show message on website
    messageElement.classList.add('chat-message');

    var avatarElement = document.createElement('i');
    var avatarText = document.createTextNode(StoC_msg.sender[0]);
    avatarElement.appendChild(avatarText);
    avatarElement.style['background-color'] = getAvatarColor(StoC_msg.sender);

    messageElement.appendChild(avatarElement);

    var usernameElement = document.createElement('span');
    var usernameText = document.createTextNode(StoC_msg.sender);
    usernameElement.appendChild(usernameText);
    messageElement.appendChild(usernameElement);

    var textElement = document.createElement('p');
    var messageText = document.createTextNode(StoC_msg.op.content);
    textElement.appendChild(messageText);

    messageElement.appendChild(textElement);

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}


function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }

    var index = Math.abs(hash % colors.length);
    return colors[index];
}




function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
function isExisted(tarParentId, tarIndex){

    let tarParent = document.getElementById(tarParentId);
    if(tarParent){
        return false;
    }
    else{ // null => had been deleted locally => had been contained
        return true;
    }
}
function TII(tarBlockOp, refBlockOp){
    let taruid = tarBlockOp.uid;
    let refuid = refBlockOp.uid;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    if(tarParentId != refParentId || tarIndex < refIndex || (tarParentId == refParentId && tarIndex == refIndex && taruid > refuid)){
        console.log(taruid, refuid);
        return tarBlockOp;
    }
    // 其他
    else{
        let xFormedOp = new Op(taruid, tarOp, tarParentId, tarIndex + 1, tarContent);
        return xFormedOp;
    }
}
function TID(tarBlockOp, refBlockOp){
    let taruid = tarBlockOp.uid;
    let refuid = refBlockOp.uid;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;

    if(isExisted(tarParentId, tarIndex)){
        //let xFormedOp = new Op(taruid, tarOp, tarParentId, tarIndex, tarContent);
        let xFormedOp = new Op(taruid, "NULL", tarParentId, tarIndex, tarContent);
        return xFormedOp;
    }
    // 若在以下條件: 1. 不在同個parent下  2. 目標index小於等於參考index => 則不改變操作
    else if(tarParentId != refParentId || tarIndex <= refIndex)
        return tarBlockOp;
    // 其他
    else{
        let xFormedOp = new Op(taruid, tarOp, tarParentId, tarIndex - 1, tarContent);
        return xFormedOp;
    }
}

function TDI(tarBlockOp, refBlockOp){
    let taruid = tarBlockOp.uid;
    let refuid = refBlockOp.uid;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    // 若在以下條件: 1. 不在同個parent下  2. 目標index小於參考index => 則不改變操作 (因為目標包含參考不需要改變，所以不多寫出來)
    if(tarParentId != refParentId || tarIndex < refIndex)
        return tarBlockOp;
    //其他
    else{
        let xFormedOp = new Op(taruid, tarOp, tarParentId, tarIndex + 1, tarContent);
        return xFormedOp;
    }
}

function TIE(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TEI(tarBlockOp, refBlockOp){
    let taruid = tarBlockOp.uid;
    let refuid = refBlockOp.uid;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    //若在以下條件: 1. 不在同個parent下  2. 目標index小於參考index => 則不改變操作
    if(tarParentId != refParentId || tarIndex < refIndex)
        return tarBlockOp;
    //其他
    else{
        let xFormedOp = new Op(taruid, tarOp, tarParentId, tarIndex + 1, tarContent);
        return xFormedOp;
    }
}

function TIF(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TFI(tarBlockOp, refBlockOp){
    let taruid = tarBlockOp.uid;
    let refuid = refBlockOp.uid;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    //目標parent包住參考parent，不會發生
    //參考parent包住目標parent，不會發生
    //若在以下條件: 1. 不在同個parent下  2. 目標index小於或參考index => 則不改變操作
    if(tarParentId != refParentId || tarIndex < refIndex)
        return tarBlockOp;
    //若在以下條件:目標index大於等於參考index =>操作index+1
    else{
        let xFormedOp = new Op(taruid, tarOp, tarParentId, tarIndex + 1, tarContent);
        return xFormedOp;
    }
}
function TDE(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TED(tarBlockOp, refBlockOp){
    let taruid = tarBlockOp.uid;
    let refuid = refBlockOp.uid;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    //目標parent包住參考parent，不會有這個操作，因為會鎖住
    //參考parent包住目標parent，不會有這個操作，因為會鎖住
    //若在以下條件: 1. 不在同個parent下  2. 目標index小於參考index => 則不改變操作
    if(tarParentId != refParentId || tarIndex <= refIndex)
        return tarBlockOp;
    //若在以下條件: 目標index大於參考index => 則目標index-1
    else{
        let xFormedOp = new Op(taruid, tarOp, tarParentId, tarIndex - 1, tarContent);
        return xFormedOp;
    }
    //其他(目標與參考index相等)，不會有這種操作，因為要先focus
}

function TDF(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TFD(tarBlockOp, refBlockOp){
    let taruid = tarBlockOp.uid;
    let refuid = refBlockOp.uid;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    //其他(目標與參考index相等)，不會有這種操作，因為要先focus
    if(tarParentId != refParentId || tarIndex <= refIndex){
        return tarBlockOp;
    }
    //條件: tarIndex > refIndex 或者其他
    else{
        let xFormedOp = new Op(taruid, tarOp, tarParentId, tarIndex - 1, tarContent);
        return xFormedOp;
    }
}
function TDD(tarBlockOp, refBlockOp){
    let taruid = tarBlockOp.uid;
    let refuid = refBlockOp.uid;
    let tarParentId = tarBlockOp.parentId;
    let refParentId = refBlockOp.parentId;
    let tarIndex = tarBlockOp.index;
    let refIndex = refBlockOp.index;
    let tarOp = tarBlockOp.type;
    let tarContent = tarBlockOp.content;
    /*let refOpIsValid = refBlockOp.isValid;
    let tarOpIsValid = tarBlockOp.isValid;*/
    // 參考包住目標 目標操作直接不執行
    if(isExisted(tarParentId,tarIndex)){
        console.log("1!!");
        let xFormedOp = new Op(taruid, "NULL", tarParentId, tarIndex, tarContent);
        return xFormedOp;
    }

    // 若在以下條件: 1. 不在同個parent下  2. 目標index小於參考index => 則不改變操作 (因為目標包含參考不需要改變，所以不多寫出來)
    if(tarParentId != refParentId || tarIndex < refIndex){
        console.log("2!!");
        return tarBlockOp;
    }

    //若在以下條件: 目標index大於參考index =>則將目標index-1
    else if(tarIndex > refIndex){
        console.log("3!!");
        let xFormedOp = new Op(taruid, tarOp, tarParentId, tarIndex - 1, tarContent);
        return xFormedOp;
    }
    //index相等,不回傳重複操作
    else if(tarIndex == refIndex){
        console.log("4!!");
        let xFormedOp = new Op(taruid, "NULL", tarParentId, tarIndex, tarContent);
        return xFormedOp;
    }
    else{
        console.log("5!!");
        return tarBlockOp;
    }
}

function TEF(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TFE(tarBlockOp, refBlockOp){
    return tarBlockOp;
}

function TEE(tarBlockOp, refBlockOp){
    return tarBlockOp;
}
function TFF(tarBlockOp, refBlockOp){
    return tarBlockOp;
}

function SendingOpToController(){
    // send Op to controller
    //console.log("state: SendingOpToController");
    if (stompClient) {
        CtoS_Msg = {
            sender: username,
            sessionId: sessionId,
            type: 'OP',
            ts: localTS,
            op: localOp
        };
        stompClient.send("/app/chat.send", {}, JSON.stringify(CtoS_Msg));
    }

    // buffer is empty => AwaitingACK state
    if(opBuffer.length <= 0){
        ClientState = ClientStateEnum.AwaitingACK;
        console.log("state: AwaitingACK");
    }
    // buffer is not empty => AwaitingWithBuffer state
    else{
        ClientState = ClientStateEnum.AwaitingWithBuffer;
        console.log("state: AwaitingWithBuffer");
    }
}

function ApplyingLocalOp(tempOp){
    //console.log("state: ApplyingLocalOp");
    // step 1: set localOp to the Op in the received LocalChange event
    localOp = tempOp;

    // step 2: increment localTS
    localTS += 1;

    // step 3: call applyOp(localOp)
    applyOp(localOp);

    // next state: SendingOpToController
    ClientState = ClientStateEnum.SendingOpToController;
    console.log("state: SendingOpToController");
    SendingOpToController();
}

function ApplyingBufferedLocalOp(tempOp){
    //console.log("state: ApplyingBufferedLocalOp");
    // step 1: add Op from the received LocalChange event to opBuffer
    opBuffer.push(tempOp);

    // step 2: call applyOp(opBuffer.last)
    applyOp(opBuffer[opBuffer.length-1]);

    // next state: AwaitingWithBuffer
    ClientState = ClientStateEnum.AwaitingWithBuffer;
    console.log("state: AwaitingWithBuffer");
}

function CreatingLocalOpFromBuffer(){
    //console.log("state: CreatingLocalOpFromBuffer");
    // step 1: increment localTS
    localTS += 1;

    // step 2: set localOp to opBuffer.first
    localOp = opBuffer[0];

    // step 3: remove opBuffer.first from opBuffer
    opBuffer.shift();

    // next state: SendingOpToController
    ClientState = ClientStateEnum.SendingOpToController;
    console.log("state: SendingOpToController");
    SendingOpToController();
}

function ApplyingRemoteOp(StoC_msg){
    //console.log("state: ApplyRemoteOp");
    // step 1: set remoteTS and remoteOp to the values within the received StoC Msg event
    remoteOp = StoC_msg.op;
    remoteTS = StoC_msg.ts;

    // step 2: set localTS to the value of remoteTS
    localTS = remoteTS;

    // step 3: call applyOp(remoteOp)
    applyOp(remoteOp);

    // next state: Synced
    ClientState = ClientStateEnum.Synced;
    console.log("state: Synced");
}

function ApplyingRemoteOpWithoutACK(StoC_msg){
    //console.log("state: ApplyingRemoteOpWithoutACK");
    // step 1: set localTS to remoteTS
    localTS = StoC_msg.ts;

    // step 2: increment localTS
    localTS += 1;

    // step 3: set remoteTS and remoteOp to the values within the received StoC Msg event
    remoteTS = StoC_msg.ts;
    remoteOp = StoC_msg.op;

    // step 4: obtain remoteOpPrime and localOpPrime by evaluating xform(remoteOp, localOp)
    //console.log("local: " + JSON.stringify(localOp));
    //console.log("remote: " + JSON.stringify(remoteOp));
    remoteOpPrime = OT(remoteOp, localOp);
    localOpPrime = OT(localOp, remoteOp);

    // step 5: call applyOp(remoteOpPrime)
    //console.log(JSON.stringify(remoteOpPrime));
    applyOp(remoteOpPrime);

    // step 6: set localOp to the value of localOpPrime
    localOp = localOpPrime;

    // next state: SendingOpToController
    ClientState = ClientStateEnum.SendingOpToController
    console.log("state: SendingOpToController");
    SendingOpToController();
}

function ApplyingRemoteOpWithBuffer(StoC_msg){
    remoteOp = StoC_msg.op;
    remoteTS = StoC_msg.ts;
    let remoteOpPrimeArray = new Array();
    // step 1: set localTS to remoteTS
    localTS = remoteTS;

    // step 2: increment localTS
    localTS += 1;

    // step 3: obtain remoteOpPrime[0] by evaluating xform(remoteOp, localOp)
    remoteOpPrimeArray[0] = OT(remoteOp, localOp);

    // step 4: obtain remoteOpPrime[i+1] by evaluating xform(remoteOpPrime[i], opBuffer[i])
    for(let i = 0; i < opBuffer.length; i++){
        remoteOpPrimeArray[i+1] = OT(remoteOpPrimeArray[i], opBuffer[i]);
    }

    // step 5: call applyOp(remoteOpPrime.last)
    applyOp(remoteOpPrimeArray[remoteOpPrimeArray.length-1]);

    // step 6: obtain localOpPrime by evaluating xform(localOp, remoteOp)
    localOpPrime = OT(localOp, remoteOp);

    // step 7: set localOp to the value of localOpPrime
    localOp = localOpPrime;

    // step 8: obtain opBuffer[i] by evaluating xform(opBuffer[i], remoteOpPrime[i]) & send
    for(let j = 0; j < opBuffer.length; j++){
        opBuffer[j] = OT( opBuffer[j], remoteOpPrimeArray[j]);
    }

    // next state: SendingOpToController
    ClientState = ClientStateEnum.SendingOpToController;
    console.log("state: SendingOpToController");
    SendingOpToController();
}
usernameForm.addEventListener('submit', connect, true)
//messageForm.addEventListener('submit', send, true)
opForm.addEventListener('submit', send, true)