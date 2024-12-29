type Payload = {
    task: string;
    apikey: string;
    query: string;
}

type DBResponse = {
    reply: Record<string, unknown>[];
    error: "OK" | "ERROR";
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

class DBGateway {
    private readonly httpClient = new HttpClient();
    constructor(private readonly params: {apiKey: string, task: string, endpoint: string}) {}

    async query(sql: string): Promise<DBResponse> {
        const payload: Payload = {
            task: this.params.task,
            apikey: this.params.apiKey,
            query: sql
        };
        return await this.httpClient.post<Payload, DBResponse>(this.params.endpoint, payload, "json");
    }
}



export { type Payload as SubmitPayload, DBGateway };
