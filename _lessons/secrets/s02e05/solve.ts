function decodeWithXOR(encoded: string, key: string): string {
    let result = '';
    for (let i = 0; i < encoded.length; i++) {
        const encodedChar = encoded.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        result += String.fromCharCode(encodedChar ^ keyChar);
    }
    return result;
}

function tryDifferentDecodings(encoded: string, key: string) {
    console.log("1. Próba XOR z kluczem:");
    console.log(decodeWithXOR(encoded, key));

    console.log("\n2. Próba Base64 + XOR:");
    try {
        const decoded = Buffer.from(encoded, 'base64').toString();
        console.log(decodeWithXOR(decoded, key));
    } catch (e) {
        console.log("Nie udało się zdekodować jako Base64");
    }

    console.log("\n3. Próba dekodowania każdego trzeciego znaku (krzyżowo):");
    let result = '';
    for (let i = 0; i < encoded.length; i += 3) {
        result += encoded[i];
    }
    console.log(result);
}

// Testujemy
const encoded = "GhUiPj1fkTM3NCY1KSUmNxkP";
const key = "Andrzej";

tryDifferentDecodings(encoded, key);
