const config = require('./config.json')
const SAPI = require('./lib/SimplyAPI.js')
const SimplyAPI = new SAPI(config)

let member = {
    name: "Test",
    desc: "a test member",
    pronouns: "It/Its",
    pkId: "",
    color: "",
    avatarUuid: "",
    avatarUrl: "",
    private: false,
    preventTrusted: false,
    preventFrontNotifs: false,
    info: {
        "Age": "19",
        "Likes": "bread"
    }
}

main = async () => {
    findMember("Test")
    createTestMember(member)
    deleteTestMember("Test")
}

findMember = async (who) => {
    SimplyAPI.findMemberCallback(who, (member) => {
        if (member) {
            console.log(member)
        }
    })
}

createTestMember = async (data) => {
    SimplyAPI.createMember(data)
       .then((response) => {
           console.log(response.data)
       })
        .catch(err => console.error(err))
}

deleteTestMember = async (who) => {
    await SimplyAPI.findMember(who, async (member) => {
        if (member) {
            await SimplyAPI.deleteMember(member.id)
                .then((res) => {
                    if (res.status == 200) {
                        console.log(`member deleted: ${res.data.content.name}.`)
                    }
                })
                .catch(err => console.error(err))
        }
    })
}

main()