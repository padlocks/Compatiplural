const axios = require('axios')
const config = require('./config.json')
const SAPI = require('./SimplyAPI')
const SimplyAPI = new SAPI(config)

const pkUrl = 'https://api.pluralkit.me/v2'
const pkHeader = {
    'Content-Type': 'application/json',
    'Authorization': config.pk_token
}

let e;
main = async () => {
    openWebSocket()
}

openWebSocket = async () => {
    const WebSocketClient = require('./WebSocketClient')
    const wss = new WebSocketClient(config.socket);
    let initialPacket = { "op": "authenticate", "token": config.token }
    wss.onOpen = (_) => { wss.send(JSON.stringify(initialPacket)); }
    wss.onClose = (e) => { console.log('SimplyWS/onClose :: %s', e); e = '' }
    wss.onError = (e) => { console.log('SimplyWS/onError :: %s', e) }

    wss.onMessage = async (raw) => {
        e = raw
        let data = JSON.parse(e)
        if (Object.keys(data).length === 0) return
        
        switch (data.msg) {
            case "Successfully authenticated":
                console.log('::SimplyWS:: authenticated')
                break;
            case "Authentication violation: Token is missing or invalid. Goodbye :)":
                console.log('::SimplyWS:: invalid token, exiting..')
                process.exit(1)
            case "update":
                let response = await generateResponse(data.target, data);
                if (response) console.log('::SimplyWS:: ' + response)
                break;
            default:
                unrecognizedMessage(data.msg)
                break;
        }
    }
}

generateResponse = async (target, data) => {
    let response = ''
    switch (target) {
        case 'frontHistory':
            response += 'Front has changed!'
            await asyncForEach(data.results, async (o) => {
                await SimplyAPI.findMemberById(o.content.member)
                    .then(async (member) => {
                        if (o.operationType == "insert") {
                            let fronters = await getPKFronters()
                            fronters.push(member.pkId)

                            axios.post(`${pkUrl}/systems/${config.pk_system}/switches`, JSON.stringify({"members": fronters}), {
                                headers: pkHeader
                            })
                            .catch(err => console.error(err.toJSON().message));

                            response += '\n' + member.name + ' was added to the front.'
                            return
                        } 
                        else {
                            let fronters = await getPKFronters()
                            let index = fronters.indexOf(member.pkId)
                            fronters.splice(index, 1)

                            axios.post(`${pkUrl}/systems/${config.pk_system}/switches`, JSON.stringify({ "members": fronters }), {
                                headers: pkHeader
                            })
                            .catch(err => console.error(err.message));

                            response += '\n' + member.name + ' was removed from the front.'
                            return
                        }
                    })
                    .catch(err => {
                        console.log('::SimplyWS:: Error finding member: ' + err)
                    })
            })
            break;
        default:
            unknownTarget(data.target)
            break;
    }
    return response
}   

unknownTarget = (target) => {
    console.log('::SimplyWS:: Unknown update target: ' + target + '\n::SimplyWS:: Full message: ' + e)
}

unrecognizedMessage = (msg) => {
    console.log('::SimplyWS:: Unrecognized message: ' + msg + '\n::SimplyWS:: Full message: ' + e)
}

findMember = (who) => {
    return new Promise(function (resolve, reject) {
        SimplyAPI.findMember(who, (member) => {
            if (member) {
                resolve(member)
            } else {
                reject({"name": "Unknown member"})
            }
        })
    })
}

getPKFronters = async () => {
    let members = []
    let fronters = await axios.get(`${pkUrl}/systems/${config.pk_system}/fronters`, {
        headers: pkHeader
    })
    .catch(err => console.error("An error occured while getting current fronters: " + err.message))

    fronters.data.members.forEach((key, value) => {
        members.push(key.id)
    })
    
    return members
}

asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

main()