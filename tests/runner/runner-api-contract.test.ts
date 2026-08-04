import { renderToString } from "@vue/server-renderer";
import { createSSRApp, h } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGetMock, apiSendMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  apiSendMock: vi.fn(),
}));

vi.mock("../../src/api/http", () => ({
  apiGet: apiGetMock,
  apiSend: apiSendMock,
  LianApiError: class LianApiError extends Error {
    status: number;
    code: string;

    constructor(message: string, status = 0, code = "") {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import {
  fetchAvailableRunnerOrders,
  markRunnerOrderAtShop,
  markRunnerOrderPickedUp,
} from "../../src/api/runner";
import { RUNNER_POINTS_SUFFIX } from "../../src/config/brand";
import RunnerOrderCard from "../../src/features/runner/RunnerOrderCard.vue";

describe("runner API contract", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiSendMock.mockReset();
  });

  it("posts the at_shop action to the real at-shop endpoint", async () => {
    apiSendMock.mockResolvedValue({
      ok: true,
      order: { orderId: "ord-1", status: "at_shop", title: "取咖啡" },
    });

    await expect(markRunnerOrderAtShop("ord-1")).resolves.toMatchObject({
      id: "ord-1",
      status: "at_shop",
    });
    expect(apiSendMock).toHaveBeenCalledWith("/api/errands/orders/ord-1/at-shop", {
      method: "POST",
    });
  });

  it("keeps a pickup response in the UI's picked_up state when backend auto-advances", async () => {
    apiSendMock.mockResolvedValue({
      ok: true,
      order: { orderId: "ord-2", status: "delivering", title: "送文件" },
    });

    await expect(markRunnerOrderPickedUp("ord-2")).resolves.toMatchObject({
      id: "ord-2",
      status: "picked_up",
    });
    expect(apiSendMock).toHaveBeenCalledWith("/api/errands/orders/ord-2/pickup", {
      method: "POST",
    });
  });

  it("normalizes canonical point fields first and legacy aliases only as fallback", async () => {
    apiGetMock.mockResolvedValue({
      items: [
        {
          orderId: "canonical",
          status: "at_shop",
          title: "正文字段",
          feePoints: 3,
          rewardPoints: 7,
          totalLockedPoints: 10,
          feeAmount: 99,
          rewardAmount: 99,
          lockedBalanceAmount: 198,
        },
        {
          orderId: "legacy",
          status: "assigned",
          title: "兼容字段",
          feeAmount: 2,
          rewardAmount: 5,
          lockedBalanceAmount: 7,
        },
      ],
    });

    const result = await fetchAvailableRunnerOrders();

    expect(result.items[0]).toMatchObject({
      status: "at_shop",
      feePoints: 3,
      rewardPoints: 7,
      totalLockedPoints: 10,
    });
    expect(result.items[1]).toMatchObject({
      status: "accepted",
      feePoints: 2,
      rewardPoints: 5,
      totalLockedPoints: 7,
    });
  });
});

describe("runner reward rendering", () => {
  it("renders reward points as points without converting them to RMB cents", async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(RunnerOrderCard, {
            order: {
              id: "ord-reward",
              status: "available",
              title: "积分展示",
              rewardPoints: 125,
            },
          }),
      }),
    );

    expect(html).toContain(`125 ${RUNNER_POINTS_SUFFIX}`);
    expect(html).not.toContain("¥");
    expect(html).not.toContain("1.25");
  });
});
