const Ajv = require('ajv')
const ajv = new Ajv()

class Validate {
    static validateSchema = async (schema, body) => {
        const validate = ajv.compile(schema)
        return validate(body)
    
    }
}
module.exports = Validate