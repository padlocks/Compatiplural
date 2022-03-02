const { resolveRef } = require('ajv/dist/compile')
const axios = require('axios')
const schemas = require('./Schemas')
const validate = require('./Validate')
/**
 * @param  {Object} config
 */
class SimplyAPI {
    constructor(config) {
        this.url = config.url_override || 'https://devapi.apparyllis.com'
        this.userId = config.userId
        this.system = config.userId
        this.token = config.token
        this.header = {
            'Content-Type': 'application/json',
            'Authorization': this.token
        }
    }

    getSystem = async () => {
        let system = await axios.get(`${this.url}/v1/members/${this.system}`, {
            headers: this.header
        })
        return system.data
            //.then((response) => response)
            //.catch(err => console.error(err.toJSON().message));
    }

    getGroups = async () => {
        return axios.get(`${this.url}/v1/groups/${this.system}`, {
            headers: this.header
        })
            .then((response) => response)
            .catch(err => console.error(err.toJSON().message));
    }

    /**
     * @param  {string} group
     * @param  {function} callback
     */
    findGroup = async (group, callback) => {
        await this.getGroups()
            .then((groups) => {
                for (let i in groups.data) {
                    if (groups.data[i].content.name.includes(group)) {
                        callback(groups.data[i])
                        return
                    }
                }
            })

    }

    createGroup = async (group) => {
        let valid = await validate.validateSchema(schemas.groupSchema, group)

        if (valid) {
            return axios.post(`${this.url}/v1/group/`, JSON.stringify(group), {
                headers: this.header,
            })
                .then((response) => response)
                .catch(err => console.error(err.toJSON().message));
        } else {
            let response = {}
            response.data = {status: 'error', message: 'Invalid group schema'}
            return response
        }
    }

    deleteGroup = async (group) => {
        return await axios.delete(`${this.url}/v1/group/${group}`, {
            headers: this.header,
        })
            .then((response) => response)
            .catch(err => console.error(err.toJSON().message));
    }

    /**
     * @param  {string} id
     */
    findMemberById = async (id) => {
        let found = false
        let system = await this.getSystem()
        return new Promise(async (resolve) => {
            await asyncForEach(system, async (m) => {
                if (m.id == id) {
                    found = true
                    resolve(m.content)
                }
            })

            if (!found) resolve({ "name": "Unknown member" })
        })
    }

    /**
     * @param  {string} member
     */
    findMember = async (member) => {
        let found = false
        let system = await this.getSystem()
        return new Promise(async (resolve) => {
            await asyncForEach(system, async (m) => {
                if (m.content.name.includes(member)) {
                    found = true
                    resolve(m)
                }
            })

            if (!found) resolve({"name": "Unknown member"})
        })
    }
    
    /**
     * @param  {string} member
     * @param  {function} callback
     */
    findMemberCallback = async (member, callback) => {
        await this.getSystem()
            .then(async (system) => {
                for (let i in system) {
                    if (system[i].content.name.includes(member)) {
                        await callback(system[i])
                        return
                    }
                }
            })
        
    }

    createMember = async (member) => {
        let valid = await validate.validateSchema(schemas.memberSchema, member)

        if (valid) {
            return axios.post(`${this.url}/v1/member/`, JSON.stringify(member), {
                headers: this.header,
            })
                .then((response) => response)
                .catch(err => console.error(err.toJSON().message));
        } else {
            let response = {}
            response.data = { status: 'error', message: 'Invalid group schema' }
            return response
        }
    }

    deleteMember = async (member) => {
        return await axios.delete(`${this.url}/v1/member/${member}`, {
                headers: this.header,
            })
            .then((response) => response)
            .catch(err => console.error(err.toJSON().message));
    }

    getFronters = async () => {
        return await axios.get(`${this.url}/v1/fronters/`, {
            headers: this.header,
        })
            .then((response) => response.data)
            .catch(err => console.error(err.toJSON().message));
    }
}

asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

module.exports = SimplyAPI