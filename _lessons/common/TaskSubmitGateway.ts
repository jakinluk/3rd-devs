type SubmitPayload<T> = {
    task: string;
    apikey: string;
    answer: T;
}

type SubmitResponse = {
    code: number;
    message: string;
}

class HttpClient {
    async post<T, R>(url: string, data: T, type: "json" | "text"): Promise<R> {
        console.debug(`HttpClientPOST ${url}`, data);
        return fetch(url, {
            method: "POST",
            body: JSON.stringify(data),
        }).then(res => type === "json" ? res.json() : res.text());
    }
}

class TaskSubmitGateway {
    private readonly httpClient = new HttpClient();
    constructor(private readonly params: {apiKey: string, task: string, endpoint: string}) {}

    async submit<T>(submit: T, type: "json" | "text"): Promise<SubmitResponse> {
        const payload: SubmitPayload<T> = {
            task: this.params.task,
            apikey: this.params.apiKey,
            answer: submit
        };
        return await this.httpClient.post<SubmitPayload<T>, SubmitResponse>(this.params.endpoint, payload, type);
    }
}



export { type SubmitPayload, TaskSubmitGateway };
