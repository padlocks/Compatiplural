const dotenv = require('dotenv')
dotenv.config()
//const config = process.env

const axios = require('axios')
const { Config, System, FrontHistory } = require('SimplyAPI')

const pkUrl = Config.pk_url
const pkHeader = {
    'Content-Type': 'application/json',
    'Authorization': Config.pk_token
}

let e
let cache = {}
main = async () => {
    openWebSocket()
}

openWebSocket = async () => {
    const WebSocketClient = require('./WebsocketClient')
    const wss = new WebSocketClient(Config.socket);
    let initialPacket = { "op": "authenticate", "token": Config.token }
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
                // cache current front
                let system = new System(Config)
                cache.frontHistory = await system.getFronters()
                break;
            case "Authentication violation: Token is missing or invalid. Goodbye :)":
                console.log('::SimplyWS:: invalid token, exiting..')
                process.exit(1)
            case "update":
                let response = await generateResponse(data.target, data);
                if (response) console.log('::SimplyWS:: ' + response)
                break;
            default:
                //unrecognizedMessage(data.msg)
                break;
        }
    }
}

generateResponse = async (target, data) => {
    let response = ''
    switch (target) {
        case 'frontHistory':
            //response += 'Front has changed!'
            await asyncForEach(data.results, async (o) => {
                let system = new System(Config)
                await system.getMemberById(o.content.member)
                    .then(async (member) => {
                        if (o.operationType == "insert") {
                            // get current fronters and add new fronter
                            let fronters = await getPKFronters()
                            fronters.push(member.content.pkId)

                            // find the "primary" fronter to move to the first element in the list
                            let primary = findPrimary()
                            if (primary) {
                                if (fronters.indexOf(primary) > 0) {
                                    fronters.splice(fronters.indexOf(primary), 1)
                                    fronters.unshift(primary)
                                }
                            }

                            // cache front
                            cache.frontHistory = await system.getFronters()

                            // post the new switch
                            axios.post(`${pkUrl}/systems/${Config.pk_system}/switches`, JSON.stringify({"members": fronters}), {
                                headers: pkHeader
                            })
                            .catch(err => {
                                if (err.toJSON().status == 400) unknownError400()
                                else console.error(err.message)
                            })

                            response += '' + member.content.name + ' was added to the front.'
                            return
                        } 
                        else {
                            // get current fronters and patch the list
                            let fronters = await getPKFronters()
                            let frontData = await system.getFronters()
                            let action = await determineAction(o, frontData)
                            // if delete operation, remove the member from the list
                            switch (action) {
                                case "remove":
                                    let index = fronters.indexOf(member.content.pkId)
                                    fronters.splice(index, 1)

                                    // find the "primary" fronter to move to the first element in the list
                                    let p = findPrimary()
                                    if (p) {
                                        if (fronters.indexOf(p) > 0) {
                                            fronters.splice(fronters.indexOf(p), 1)
                                            fronters.unshift(p)
                                        }
                                    }

                                    // cache front
                                    cache.frontHistory = await system.getFronters()

                                    // post the new switch
                                    axios.post(`${pkUrl}/systems/${Config.pk_system}/switches`, JSON.stringify({ "members": fronters }), {
                                        headers: pkHeader
                                    })
                                    .catch(err => {
                                        if (err.toJSON().status == 400) unknownError400()
                                        else console.error(err.message)
                                    })

                                    response += '' + member.content.name + ' was removed from the front.'
                                    break;

                                case "customStatus":
                                    // find the "primary" fronter to move to the first element in the list
                                    let primary = await findPrimary()
                                    if (primary && fronters.length > 1) {
                                        if (fronters.indexOf(primary) >= 0) {
                                            fronters.splice(fronters.indexOf(primary), 1)
                                            fronters.unshift(primary)

                                            // cache front
                                            cache.frontHistory = await system.getFronters()

                                            // post the new switch
                                            axios.post(`${pkUrl}/systems/${Config.pk_system}/switches`, JSON.stringify({ "members": fronters }), {
                                                headers: pkHeader
                                            })
                                            .catch(err => {
                                                if (err.toJSON().status == 400) unknownError400()
                                                else console.error(err.message)
                                            })
                                            response += '' + member.content.name + ' is now the primary fronter.'
                                        }
                                    }
                                    else {
                                        response += '' + member.content.name + ' changed custom status.'
                                    }
                                    break;
                            }
                            return
                        }
                    })
                    .catch(err => {
                        console.log('::SimplyWS:: Error finding member: ' + err)
                    })
            })
            break;
        default:
            //unknownTarget(data.target)
            break;
    }
    return response
}   

unknownError400 = () => {
    return
}

unknownTarget = (target) => {
    console.log('::SimplyWS:: Unknown update target: ' + target + '\n::SimplyWS:: Full message: ' + e)
}

unrecognizedMessage = (msg) => {
    console.log('::SimplyWS:: Unrecognized message: ' + msg + '\n::SimplyWS:: Full message: ' + e)
}

getPKFronters = async () => {
    let members = []
    let fronters = await axios.get(`${pkUrl}/systems/${Config.pk_system}/fronters`, {
        headers: pkHeader
    })
    .catch(err => console.error("An error occured while getting current fronters: " + err.message))

    fronters.data.members.forEach((key, value) => {
        members.push(key.id)
    })
    
    return members
}

findPrimary = async () => {  
    let found = false
    let system = new System(Config)
    let fronters = await system.getFronters()
    return new Promise(async (resolve) => {
        await asyncForEach(fronters, async (fronter) => {
            if (fronter.content.customStatus) {
                if (fronter.content.customStatus.toLowerCase().includes("primary")) {
                    let member = await system.getMemberById(fronter.content.member)
                    resolve(member.content.pkId)
                    found = true
                }
            }
        })

        if (!found) resolve(false)
    })
}

determineAction = async (eventData, frontData = []) => {
    if (frontData.length == 0) return 'remove'
    let action = ''

    // check for cache
    if (!cache.frontHistory) {
        let system = new System(Config)
        let frontHistory = await system.getFronters()
        cache.frontHistory = frontHistory
    }

    // get the difference between cached history and current front
    let diff = await calculateDiff(cache.frontHistory, frontData)
    // we handle one thing at a time, although this should be expanded since you can modify multiple custom statuses at once
    if (diff.length >= 1) {
        if (diff[0].content.customStatus || eventData.content.customStatus || diff[0].content.customStatus == "" || eventData.content.customStatus == "") {
            // check if customStatus value is in cache
            let foundInCache = Object.keys(cache.frontHistory).filter((key) => {
                return cache.frontHistory[key] === diff[0].content.customStatus
            })

            // if value is unique, publish action
            if (foundInCache.length == 0) {
                action = 'customStatus'
            }
        }
        else {
            if (eventData.content.customStatus == '') return 'customStatus'
            console.error('::SimplyWS:: Unrecognized diff: ' + JSON.stringify(diff))
        }
    }
    else {
        // if there's an endTime, it was a removal event
        if (eventData.content.endTime && !eventData.content.live) {
            action = 'remove'
        }
    }

    return action
}

asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

const { inspect } = require('util')
const transform = require('lodash.transform')
const isEqual = require('lodash.isequal')
const isArray = require('lodash.isarray')
const isObject = require('lodash.isobject')
const { PassThrough } = require('stream')
calculateDiff = async (origObj, newObj) => {
    return new Promise(function (resolve) {
        changes = (newObj, origObj) => {
            let arrayIndexCounter = 0
            return transform(newObj, function (result, value, key) {
                if (!isEqual(value, origObj[key])) {
                    let resultKey = isArray(origObj) ? arrayIndexCounter++ : key
                    result[resultKey] = (isObject(value) && isObject(origObj[key])) ? changes(value, origObj[key]) : value
                }
            })
        }
        resolve(changes(newObj, origObj))
    })
}

main()