import axios from "axios";
import config from '../../config/env.js';

const sendToWhatsApp = async (data) => {
    const baseUrl = `${config.BASE_URL}/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`;
    const headers = {
        Authorization: `Bearer ${config.API_TOKEN}`
    };

    try {
        const response = await axios({
            method: 'POST',
            url: baseUrl,
            headers: headers,
            data,
        })
        return response.data;
    } catch (error) {
        console.error('❌ Error enviando a WhatsApp API:', error?.response?.data?.error?.message || error?.message || error);
        if (error?.response?.data?.error?.code) {
            console.error('Código de error:', error.response.data.error.code);
        }
        throw error;
    }
};

export default sendToWhatsApp;