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
    async post<T, R>(url: string, data: T): Promise<R> {
        console.log(`HttpClientPOST ${url}`, data);
        return fetch(url, {
            method: "POST",
            body: JSON.stringify(data),
        }).then(res => res.json());
    }
}

class TaskSubmitGateway {
    private readonly httpClient = new HttpClient();
    constructor(private readonly params: {apiKey: string, task: string, endpoint: string}) {}

    async submit<T>(submit: SubmitPayload<T>): Promise<SubmitResponse> {
        return await this.httpClient.post<SubmitPayload<T>, SubmitResponse>(this.params.endpoint, submit);
    }
}



export { type SubmitPayload, TaskSubmitGateway };
