
import { describe, expect, it } from "vitest";
import { normalizarNotificacao } from "./normalizers.ts";
import { resumirIngestao } from "./report.ts";
import type { ResultadoProcessamento } from "./processor.ts";
import type { ProblemaValidacao } from "./validators.ts";

function criarResultado(
	problemas: ProblemaValidacao[] = [],
): ResultadoProcessamento {
	return {
		notificacao: normalizarNotificacao({}, "dengue"),
		problemas,
	};
}

async function* fluxo(
	resultados: ResultadoProcessamento[],
): AsyncGenerator<ResultadoProcessamento> {
	for (const resultado of resultados) {
		yield resultado;
	}
}

describe("resumirIngestao", () => {
	it("gera relatório vazio quando não recebe registros", async () => {
		const relatorio = await resumirIngestao(fluxo([]));

		expect(relatorio).toEqual({
			total: 0,
			semProblemas: 0,
			comAvisos: 0,
			comErros: 0,
			problemas: [],
		});
	});

	it("contabiliza registros sem problemas, com avisos e com erros", async () => {
		const resultados = [
			criarResultado(),
			criarResultado([
				{
					campo: "nu_idade_n",
					codigo: "idade_invalida",
					severidade: "aviso",
					mensagem: "Código de idade inválido.",
				},
			]),
			criarResultado([
				{
					campo: "dt_notific",
					codigo: "campo_invalido",
					severidade: "erro",
					mensagem: "Data inválida.",
				},
			]),
			criarResultado([
				{
					campo: "dt_sin_pri",
					codigo: "data_futura",
					severidade: "aviso",
					mensagem: "Data posterior à referência.",
				},
				{
					campo: "dt_notific",
					codigo: "campo_invalido",
					severidade: "erro",
					mensagem: "Data inválida.",
				},
			]),
		];

		const relatorio = await resumirIngestao(fluxo(resultados));

		expect(relatorio.total).toBe(4);
		expect(relatorio.semProblemas).toBe(1);
		expect(relatorio.comAvisos).toBe(2);
		expect(relatorio.comErros).toBe(2);
	});

	it("agrupa ocorrências por campo, código e severidade", async () => {
		const resultados = [
			criarResultado([
				{
					campo: "dt_notific",
					codigo: "campo_invalido",
					severidade: "erro",
					mensagem: "Data inválida.",
				},
			]),
			criarResultado([
				{
					campo: "dt_notific",
					codigo: "campo_invalido",
					severidade: "erro",
					mensagem: "Data inválida.",
				},
				{
					campo: "nu_idade_n",
					codigo: "idade_invalida",
					severidade: "aviso",
					mensagem: "Código de idade inválido.",
				},
			]),
		];

		const relatorio = await resumirIngestao(fluxo(resultados));

		expect(relatorio.problemas).toEqual([
			{
				campo: "dt_notific",
				codigo: "campo_invalido",
				severidade: "erro",
				quantidade: 2,
			},
			{
				campo: "nu_idade_n",
				codigo: "idade_invalida",
				severidade: "aviso",
				quantidade: 1,
			},
		]);
	});
});
