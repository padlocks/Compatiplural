const axios = require('axios')
const { Config, System, Util } = require('simplyapi')

const pkUrl = Config.pk_url
const pkHeader = {
    'Content-Type': 'application/json',
    'Authorization': Config.pk_token
}

let cache = {}
async function initializeCache() {
    let system = new System(Config)
    cache.frontHistory = await system.getFronters()
}

function unknownError400() {
    return
}

function unknownTarget(target) {
    console.log('::SimplyWS:: Unknown update target: ' + target + '\n::SimplyWS:: Full message: ' + e)
}

function unrecognizedMessage(msg) {
    console.log('::SimplyWS:: Unrecognized message: ' + msg + '\n::SimplyWS:: Full message: ' + e)
}

// async function asyncForEach(array, callback) {
//     for (let index = 0; index < array.length; index++) {
//         await callback(array[index], index, array)
//     }
// }

async function getPKFronters() {
    let members = []
    let fronters = await axios.get(`${pkUrl}/systems/${Config.pk_system}/fronters`, {
        headers: pkHeader
    })
        .catch((err) => {
            if (err.toJSON().status == 429)
                // Too many requests
                setTimeout(async () => {
                    return await getPKFronters()
                }, 1500)
        })

    if (fronters != undefined) {
        fronters.data.members.forEach((key, value) => {
            members.push(key.id)
        })
    }

    return members
}

async function findPrimary() {
    let found = false
    let system = new System(Config)
    let fronters = await system.getFronters()
    return new Promise(async (resolve) => {
        await Util.asyncForEach(fronters, async (fronter) => {
            if (fronter.content.customStatus) {
                if (fronter.content.customStatus.toLowerCase().includes("primary")) {
                    let member = await system.getMemberById(fronter.content.member)
                    resolve(member.content.pkId)
                    found = true
                }
            }
        })

        if (!found)
            resolve(false)
    })
}

async function determineAction(eventData, frontData = []) {
    if (frontData.length == 0)
        return 'remove'
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
            if (eventData.content.customStatus == '')
                return 'customStatus'
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

async function insertFront(member) {
    // get current fronters and add new fronter
    let system = new System(Config)
    let fronters = await getPKFronters()
    fronters.push(member.content.pkId)

    // find the "primary" fronter to move to the first element in the list
    let primary = await findPrimary()
    if (primary) {
        if (fronters.indexOf(primary) > 0) {
            fronters.splice(fronters.indexOf(primary), 1)
            fronters.unshift(primary)
        }
    }

    // cache front
    cache.frontHistory = await system.getFronters()

    // post the new switch
    axios.post(`${pkUrl}/systems/${Config.pk_system}/switches`, JSON.stringify({ "members": fronters }), {
        headers: pkHeader
    })
        .catch(err => {
            if (err.toJSON().status == 400)
                unknownError400()
            else if (err.toJSON().status == 429)
                // Too many requests
                setTimeout(function () {
                    insertFront(member)
                }, 1000)
                return
        })

    let checkFront = await getPKFronters()
    if (!checkFront.includes(member.content.pkId)) {
        await insertFront(member)
        return
    } else {
        console.log('::SimplyWS:: ' + member.content.name + ' was added to the front.')
    }
}

async function removeFront(member) {
    let system = new System(Config)
    let fronters = await getPKFronters()
    let index = fronters.indexOf(member.content.pkId)
    fronters.splice(index, 1)

    // find the "primary" fronter to move to the first element in the list
    let p = await findPrimary()
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
            if (err.toJSON().status == 400)
                unknownError400()
            else if (err.toJSON().status == 429)
                // Too many requests
                setTimeout(function () {
                    removeFront(member)
                }, 1000)
                return
        })
    
    let checkFront = await getPKFronters()
    if (checkFront.includes(member.content.pkId)) {
        await removeFront(member)
        return
    } else {
        console.log('::SimplyWS:: ' + member.content.name + ' was removed from the front.')
    }
}

async function updateCustomStatus(member) {
    // find the "primary" fronter to move to the first element in the list
    let system = new System(Config)
    let fronters = await getPKFronters()
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
                    if (err.toJSON().status == 400)
                        unknownError400()
                    else if (err.toJSON().status == 429)
                        // Too many requests
                        setTimeout(function () {
                            updateCustomStatus(member)
                        }, 1000)
                        return
                })

            console.log('::SimplyWS:: ' + member.content.name + ' is now the primary fronter.')
        }
    }
    else {
        console.log('::SimplyWS:: ' + member.content.name + ' changed custom status.')
    }
}

const { inspect } = require('util')
const transform = require('lodash.transform')
const isEqual = require('lodash.isequal')
const isArray = require('lodash.isarray')
const isObject = require('lodash.isobject')
const { PassThrough } = require('stream')
async function calculateDiff(origObj, newObj) {
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

module.exports = {
    initializeCache,
    unknownError400,
    unknownTarget,
    unrecognizedMessage,
    getPKFronters,
    findPrimary,
    determineAction,
    insertFront,
    removeFront,
    updateCustomStatus,
    calculateDiff 
}