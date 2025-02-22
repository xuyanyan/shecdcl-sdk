'use strict'

const axios = require('axios')
const NodeCache = require('node-cache')
const logger = require('log4js').getLogger('default')
const codeTable = require('./code')

module.exports = class shecgw {
    #appId = '';
    #appSecret = '';
    #apiGwEndPoint = '';
    #debug = false;
    #getAccessTokenUrl = '';
    #getHealthUrl = '';
    #getHsjcUrl = '';
    #getJkmUserInfoUrl = '';
    #getYimiaoUrl = '';

    // 系统级缓存
    #accessTokenCache = new NodeCache({
        stdTTL: 24 * 60 * 60 // 24 Hours
    })

    debug (...args){
      if (this.#debug){
        logger.debug(args);
      }
    }

    constructor(appId, appSecret, apiGwEndPoint, debug = false) {
        if(!appId) throw 'Parameter appId cannot be null';
        if(!appSecret) throw 'Parameter appSecret cannot be null';
        if(!apiGwEndPoint) throw 'Parametter apiGwEndPoint cannot be null';

        this.#appId = appId;
        this.#appSecret = appSecret;
        this.#apiGwEndPoint = apiGwEndPoint;
        this.#debug = debug;

        this.#getAccessTokenUrl = apiGwEndPoint + '/gateway/auth/accesstoken/create';
        this.#getHealthUrl = apiGwEndPoint + '/gateway/interface-sj-ssmjm/getInfo';
        this.#getHsjcUrl = apiGwEndPoint + '/gateway/interface-gj-xgfy-hsjcsjfwjk/getInfo';
        this.#getJkmUserInfoUrl = apiGwEndPoint + '/gateway/interface-sj-jkmjk/getInfo';
        this.#getYimiaoUrl = apiGwEndPoint + '/gateway/interface-gj-xgymjzxx/getInfo';
    }

    /**
     * 获取Access Token，缓存默认有效期为24小时。
     * @returns JSON Object
     */
    async getAccessToken() {
        let token = this.#accessTokenCache.get('access_token');
        if (token !== undefined) {
            this.debug('found token: ', token);
            return { code: "0", token: token };
        } else {
            this.debug('not found token, retrieve it from remote');
        }

        const url = this.#getAccessTokenUrl + '?appId=' + this.#appId + '&appSecret=' + this.#appSecret;
        try {
            let res = await axios.get(url);
            let json = res.data;
            this.debug(json);
            if (json.hasOwnProperty('access_token')) {
                token = json.access_token;
                // Cache it
                this.#accessTokenCache.set('access_token', token);
                // return
                return { code: "0", token: token };
            }

            // error occurs
            return json; // such as : {"status":500,"code":"GATEWAY0002","msg":"appId或appSecret错误。"}    
        } catch (err) {
            return { code: "-1", message: err.message, err: err };
        }
    }

    /**
     * 获取用户的健康码状态
     * @param {string} xm 姓名
     * @param {string} zjhm  证件号码
     * @returns 
     */
    async GetSjSsmjm(xm, zjhm) {
        const postData = {
            "XM": xm,
            "ZJHM": zjhm
        }

        const token = await this.getAccessToken();
        this.debug('Token: ', token);
        if (token.code !== '0') {
            logger.log('failed to get access token', token.message);
            return token;
        }

        const postOptions = {
            headers: {
                'Content-Type': 'application/json',
                'access_token': token.token,
                'authoritytype': '2',
                'elementsVersion': '1.00'
            },
        }

        logger.log(postOptions);

        try {
            this.debug('get health');
            let r = await axios.post(this.#getHealthUrl, postData, postOptions);
            logger.log(r.data)
            const result = r.data
            if (result.code == '0') {
                if (result.data.length > 0) {
                    return result;

                } else {
                    return {
                        code: "3",
                        message: 'Parameter XM and ZJHM does not match'
                    }
                }
            } else {
                return result
            }
        } catch (err) {
            return {
                code: "-1",
                message: err.toString()
            }
        }
    }

    /**
     * 获取核酸检测信息
     * @param {string} xm 
     * @param {string} zjhm 
     * @returns 
     */
    async GetGjXgfyHsjcsjfwjk(xm, zjhm) {
        // Try to get result
        const postData = {
            "xm": xm,
            "zjhm": zjhm
        }

        const token = await this.getAccessToken();
        if (token.code !== '0') {
            logger.log('failed to get access token', token.message);
            return token;
        }

        const postOptions = {
            headers: {
                'Content-Type': 'application/json',
                'authoritytype': '2',
                'elementsVersion': '1.00',
                'access_token': token.token
            },
        }

        this.debug(postOptions);

        try {
            let r = await axios.post(this.#getHsjcUrl, postData, postOptions);
            this.debug(r.data)
            const result = r.data
            if (result.code != 200) {
                return {
                    code: "-1",
                    message: "error occurred",
                    data: result
                }
            }

            const resultData = JSON.parse(result.data)
            logger.log(resultData)
            if (resultData.code != '200') {
                return resultData
            }

            if (resultData.data === "") {
                return {
                    code: "1",
                    message: resultData.message
                }
            }

            let value = resultData
            value.code = "0"
            return value

        } catch (err) {
            logger.log(err)
            return {
                code: "-1",
                message: err.toString()
            }
        }
    }

    /**
     * 扫码获取人员信息
     * @param {string} url 
     * @returns 
     */
    async GetsjJkmjk(url) {
        if (!url || url.length == 0) {
            this.debug("no parameter specified")
            return {
                code: "-1",
                message: "no parameter specified"
            }
        }

        try {
            const postData = {
                "data": url,
            }
            this.debug(postData)

            const token = await this.getAccessToken();
            if (token.code !== '0') {
                logger.log('failed to get access token', token.message);
                return token;
            }

            const postOptions = {
                headers: {
                    'Content-Type': 'application/json',
                    'authoritytype': '2',
                    'elementsVersion': '1.00',
                    'access_token': token.token
                },
            }
            this.debug(postOptions)
            // 返回结果事例
            // {
            // "code": "0",
            //  "data": "{\"xm\":\"王玉平\",\"phone\":\"137****3711\",\"type\":\"00\",\"zjhm\":\"370782********1417\",\"dzzz\":\"1\",\"uuid\":\"*****\"}",
            // "message": ""
            // }

            let r = await axios.post(this.#getJkmUserInfoUrl, postData, postOptions);
            let ret = r.data
            this.debug(ret)
            if (ret.code != '0') {
                return ret;
            }

        } catch (err) {
            this.debug(err)
            return {
                code: "-1",
                message: err.message
            }
        }
    }

    /**
     * 获取新冠疫苗接种信息
     * @param {string} xm 
     * @param {string} zjhm 
     * @returns 
     */
    async GetGjXgymjzxx(xm, zjhm) {
        // Try to get result
        const postData = {
            "xm": xm,
            "zjhm": zjhm
        }

        const token = await this.getAccessToken();
        if (token.code !== '0') {
            logger.log('failed to get access token', token.message);
            return token;
        }

        const postOptions = {
            headers: {
                'Content-Type': 'application/json',
                'authoritytype': '2',
                'elementsVersion': '1.00',
                'access_token': token.token
            },
        }

        this.debug(postOptions);

        try {
            let r = await axios.post(this.#getYimiaoUrl, postData, postOptions);
            this.debug(r.data)
            const result = r.data
            if (result.code != 200) {
                return {
                    code: "-1",
                    message: "error occurred",
                    data: result
                }
            }

            const resultData = JSON.parse(result.data)
            logger.log(resultData)
            if (resultData.code != '200') {
                return resultData
            }

            if (resultData.data === "") {
                return {
                    code: "1",
                    message: resultData.message
                }
            }

            let ymxx = JSON.parse(resultData.data);
            ymxx.gaztStr = ymxx.gazt == '01' ? '正常' : '删除';
            ymxx.gjStr = codeTable.getGjxx(ymxx.gj); // 国籍
            ymxx.zjlxStr = codeTable.getZjlx(ymxx.zjlx); // 证件类型
            ymxx.list = JSON.parse(ymxx.jzxxlb); // 注射列表
            ymxx.list.forEach(o => {
                o.ymmcStr = codeTable.getYmmc(o.ymmc);
                o.scqyStr = codeTable.getYmqy(o.scqy);
                o.jzdStr = codeTable.getXzqh(o.jzd);
            })

            this.debug(ymxx);
            return {code: '0', data: ymxx};

        } catch (err) {
            logger.log(err)
            return {
                code: "-1",
                message: err.toString()
            }
        }
    }
}
