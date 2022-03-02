const dotenv = require('dotenv')
dotenv.config()
const config = process.env

const axios = require('axios')
const SAPI = require('./SimplyAPI')
const SimplyAPI = new SAPI(config)

const pkUrl = config.pk_url
const pkHeader = {
    'Content-Type': 'application/json',
    'Authorization': config.pk_token
}

let e
let cache = {}
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
                // cache current front
                cache.frontHistory = await SimplyAPI.getFronters()
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
            //response += 'Front has changed!'
            await asyncForEach(data.results, async (o) => {
                await SimplyAPI.findMemberById(o.content.member)
                    .then(async (member) => {
                        if (o.operationType == "insert") {
                            // get current fronters and add new fronter
                            let fronters = await getPKFronters()
                            fronters.push(member.pkId)

                            // find the "primary" fronter to move to the first element in the list
                            let primary = findPrimary()
                            if (primary) {
                                if (fronters.indexOf(primary) > 0) {
                                    fronters.splice(fronters.indexOf(primary), 1)
                                    fronters.unshift(primary)
                                }
                            }

                            // cache front
                            cache.frontHistory = await SimplyAPI.getFronters()

                            // post the new switch
                            axios.post(`${pkUrl}/systems/${config.pk_system}/switches`, JSON.stringify({"members": fronters}), {
                                headers: pkHeader
                            })
                            .catch(err => console.error(err.toJSON().message))

                            response += '' + member.name + ' was added to the front.'
                            return
                        } 
                        else {
                            // get current fronters and patch the list
                            let fronters = await getPKFronters()
                            let frontData = await SimplyAPI.getFronters()
                            let action = await determineAction(o, frontData)
                            // if delete operation, remove the member from the list
                            switch (action) {
                                case "remove":
                                    let index = fronters.indexOf(member.pkId)
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
                                    cache.frontHistory = await SimplyAPI.getFronters()

                                    // post the new switch
                                    axios.post(`${pkUrl}/systems/${config.pk_system}/switches`, JSON.stringify({ "members": fronters }), {
                                        headers: pkHeader
                                    })
                                    .catch(err => console.error(err.message))

                                    response += '' + member.name + ' was removed from the front.'
                                    break;

                                case "customStatus":
                                    // find the "primary" fronter to move to the first element in the list
                                    let primary = await findPrimary()
                                    if (primary && fronters.length > 1) {
                                        if (fronters.indexOf(primary) > 0) {
                                            fronters.splice(fronters.indexOf(primary), 1)
                                            fronters.unshift(primary)

                                            // cache front
                                            cache.frontHistory = await SimplyAPI.getFronters()

                                            // post the new switch
                                            axios.post(`${pkUrl}/systems/${config.pk_system}/switches`, JSON.stringify({ "members": fronters }), {
                                                headers: pkHeader
                                            })
                                            .catch(err => console.error(err.message))
                                            response += '' + member.name + ' is now the primary fronter.'
                                        }
                                    }
                                    else {
                                        response += '' + member.name + ' changed custom status.'
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

findPrimary = async () => {    
    let found = false
    let fronters = await SimplyAPI.getFronters()
    return new Promise(async (resolve) => {
        await asyncForEach(fronters, async (fronter) => {
            if (fronter.content.customStatus) {
                if (fronter.content.customStatus.toLowerCase().includes("primary")) {
                    let member = await SimplyAPI.findMemberById(fronter.content.member)
                    resolve(member.pkId)
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
        let frontHistory = await SimplyAPI.getFronters()
        cache.frontHistory = frontHistory
    }

    // get the difference between cached history and current front
    let diff = calculateDiff(cache.frontHistory, frontData)
    // we handle one thing at a time, although this should be expanded since you can modify multiple custom statuses at once
    if (diff.length == 1) {
        // if there's an endTime, it was a removal event
        if (diff[0].content.endTime) {
            action = 'remove'
        }
        else if (diff[0].content.customStatus) {
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
            console.error('::SimplyWS:: Unrecognized diff: ' + JSON.stringify(diff))
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
calculateDiff = (origObj, newObj) => {
    changes = (newObj, origObj) => {
        let arrayIndexCounter = 0
        return transform(newObj, function (result, value, key) {
            if (!isEqual(value, origObj[key])) {
                let resultKey = isArray(origObj) ? arrayIndexCounter++ : key
                result[resultKey] = (isObject(value) && isObject(origObj[key])) ? changes(value, origObj[key]) : value
            }
        })
    }
    return changes(newObj, origObj)
}

main()