
import { describe, expect, it, vi } from "vitest";
import { exportarIngestao } from "./exporter.ts";

function criarResposta(registros: Record<string, unknown>[]) {
	return {
		ok: true,
		status: 200,
		statusText: "OK",
		json: async () => ({
			chikungunya: registros,
			zikavirus: registros,
		}),
	} as Response;
}

describe("exportarIngestao", () => {
	it("exporta notificações normalizadas e metadados", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			criarResposta([
				{
					nu_ano: "2026",
					dt_notific: "2026-01-15",
					sem_pri: "202603",
					id_municip: "355030",
					classi_fin: "13",
				},
			]),
		);

		const resultado = await exportarIngestao(
			"chikungunya",
			{ dataReferencia: "2026-11-15" },
			fetcher,
		);

		expect(resultado.metadados).toEqual({
			doenca: "chikungunya",
			municipioNotificacao: "355030",
			fonte: "DEMAS",
			dataReferencia: "2026-11-15",
		});

		expect(resultado.notificacoes).toHaveLength(1);
		expect(resultado.notificacoes[0]).toMatchObject({
			doenca: "chikungunya",
			anoNotificacao: 2026,
			dataNotificacao: "2026-01-15",
			municipioNotificacao: "355030",
			classificacaoFinal: "13",
		});

		expect(resultado.qualidade.total).toBe(1);
		expect(resultado.qualidade.semProblemas).toBe(1);
	});

	it("consulta a API filtrando o município de São Paulo", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			criarResposta([]),
		);

		await exportarIngestao(
			"chikungunya",
			{ dataReferencia: "2026-11-15" },
			fetcher,
		);

		expect(fetcher).toHaveBeenCalledOnce();

		const url = new URL(String(fetcher.mock.calls[0]![0]));

		expect(url.searchParams.get("id_municip")).toBe("355030");
	});

	it("preserva notificações mesmo quando possuem problemas de validação", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			criarResposta([
				{
					nu_ano: "2026",
					dt_notific: "data-invalida",
					id_municip: "355030",
				},
			]),
		);

		const resultado = await exportarIngestao(
			"chikungunya",
			{ dataReferencia: "2026-11-15" },
			fetcher,
		);

		expect(resultado.notificacoes).toHaveLength(1);
		expect(resultado.qualidade.total).toBe(1);
		expect(resultado.qualidade.comErros).toBe(1);
		expect(resultado.qualidade.problemas).toContainEqual(
			expect.objectContaining({
				campo: "dt_notific",
				codigo: "campo_invalido",
				severidade: "erro",
				quantidade: 1,
			}),
		);
	});

	it("exporta corretamente dados de Zika", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			criarResposta([
				{
					nu_ano: "2026",
					dt_notific: "2026-01-15",
					id_municip: "355030",
					classi_fin: "1",
				},
			]),
		);

		const resultado = await exportarIngestao(
			"zika",
			{ dataReferencia: "2026-11-15" },
			fetcher,
		);

		expect(resultado.metadados.doenca).toBe("zika");
		expect(resultado.notificacoes).toHaveLength(1);
		expect(resultado.notificacoes[0]!.doenca).toBe("zika");
		expect(resultado.notificacoes[0]!.classificacaoFinal).toBe("1");
	});
});
