
# Zadanie
Twoim zadaniem jest przygotowanie metadanych do 10 raportów dostarczonych w formacie TXT. Dotyczą one wydarzeń związanych z bezpieczeństwem, które zdarzyły się w różnych sektorach wokół fabryki. Metadane powinny ułatwić centrali wyszukiwanie tych raportów za pomocą własnych technologii. Sugerujemy, aby metadane zawierały słowa kluczowe w języku polskim, opisujące dany raport. Bardzo ważne jest przy generowaniu słów kluczowych uwzględnienie całej posiadanej przez nas wiedzy (np. folder z faktami, czy odwołania w innych raportach).


# Oczekiwany format odpowiedzi w polu ‘answer’
```
{
"nazwa-pliku-01.txt":"lista, słów, kluczowych 1",
"nazwa-pliku-02.txt":"lista, słów, kluczowych 2",
"nazwa-pliku-03.txt":"lista, słów, kluczowych 3",
"nazwa-pliku-NN.txt":"lista, słów, kluczowych N"
}
```

# kroki do wykonania:
- laod all txt files from the files/facts folder
- join content of all txt files into one string separated by new lines and file name
- load all reportstxt files from the files/ folder
- join content of all txt files into one string separated by new lines and file name
- generate key words for each report using the keyWordsTextExtractorSystemMessage
- return the result in the expected format

