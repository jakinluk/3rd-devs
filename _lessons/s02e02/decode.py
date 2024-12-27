def parse_source_text(source_text: str) -> list[list[str]]:
    # Split text into paragraphs and clean up empty lines
    paragraphs = [p.strip() for p in source_text.split('\n\n') if p.strip()]
    # Split each paragraph into words
    return [paragraph.split() for paragraph in paragraphs]

def decode_cipher(cipher: str, paragraphs: list[list[str]]) -> str:
    # Split the cipher into individual codes
    codes = [code.strip().rstrip('.') for code in cipher.split() if code.strip() and code.startswith('A')]
    print(codes)
    decoded_words = []
    
    for code in codes:
        # Extract paragraph (A) and word (S) numbers
        paragraph_num = int(code[1]) - 1  # A1 -> index 0
        word_num = int(code[3:]) - 1      # S53 -> index 52
        print(paragraph_num, word_num)

        # print("paragraph")
        # print(paragraphs[paragraph_num])
        
        try:
            word = paragraphs[paragraph_num][word_num]
            # print(word)
            decoded_words.append(word)
        except IndexError:
            decoded_words.append(f"[ERROR:{code}]")
    
    return ' '.join(decoded_words)

# Read source file
with open('source.txt', 'r', encoding='utf-8') as file:
    source_text = file.read()

    # Read cipher file
    with open('riddle.txt', 'r', encoding='utf-8') as file:
        cipher_text = file.read()

        # print("source")
        # print(source_text)

        # Parse the source text into paragraphs and words
        paragraphs = parse_source_text(source_text)

        # print(paragraphs)

        # Extract and print each line of the cipher separately
        for line in cipher_text.splitlines():
            if line.startswith('A'):
                decoded = decode_cipher(line, paragraphs)
                print(f"Decoded line: {decoded}")