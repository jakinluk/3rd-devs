

type SubmitPayload = {
  task: string;
  apikey: string;
  answer: string;
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

class RemotePhotoFix {
  private readonly httpClient = new HttpClient();
  constructor(private readonly params: {apiKey: string, task: string, endpoint: string}) {}

  async submit(filename: string, repairType: "REPAIR" | "DARKEN" | "BRIGHTEN"): Promise<SubmitResponse> {
      const payload: SubmitPayload = {
          task: this.params.task,
          apikey: this.params.apiKey,
          answer: `${repairType} ${filename}`
      };
      return await this.httpClient.post<SubmitPayload, SubmitResponse>(this.params.endpoint, payload, "json");
  }
}


export interface ToFix {
  repair: string[];
  darken: string[];
  brighten: string[];
}

export class PhotoFix {
  private readonly remotePhotoFix = new RemotePhotoFix({
    apiKey: process.env.API_KEY!,
    task: 'photos',
    endpoint: 'https://centrala.ag3nts.org/report'
  });

  /**
   * Applies fixes to photos based on the analysis result
   * @param analysis Result from fix-photos prompt
   * @returns Array of fixed photo file paths
   */
  async applyFixes(input: ToFix): Promise<string[]> {
    const promises:Promise<SubmitResponse>[] = [];
    if (input.repair.length > 0) {
      promises.push(...input.repair.map(filename => this.remotePhotoFix.submit(filename, "REPAIR")));
    }
    if (input.darken.length > 0) {
      promises.push(...input.darken.map(filename => this.remotePhotoFix.submit(filename, "DARKEN")));
    }
    if (input.brighten.length > 0) {
      promises.push(...input.brighten.map(filename => this.remotePhotoFix.submit(filename, "BRIGHTEN")));
    }
    const results = await Promise.all(promises);
    return results.map(result => result.message);
  }
} 