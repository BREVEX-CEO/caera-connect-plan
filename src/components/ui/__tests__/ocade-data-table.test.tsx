// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { OcadeDataTable, type OcadeTableColumn } from "../ocade-data-table";
import { readTablePreferences } from "../data-table-preferences";

/**
 * THE TABLE, DRIVEN THE WAY A PERSON DRIVES IT.
 *
 * The arithmetic is tested exhaustively next door, in `data-table-model`. What
 * cannot be tested there is whether pressing a header actually sorts the rows
 * on screen, whether a screen reader is told which column is sorted, and
 * whether a hidden column stays hidden after a reload. Each of those is a wiring
 * question, and wiring is what breaks.
 */

interface Person {
  id: string;
  name: string;
  seats: number;
  joined: Date;
  active: boolean;
}

const PEOPLE: Person[] = [
  { id: "1", name: "Ada", seats: 9, joined: new Date("2026-03-01"), active: true },
  { id: "2", name: "Grace", seats: 10, joined: new Date("2026-01-01"), active: false },
  { id: "3", name: "Alan", seats: 2, joined: new Date("2026-06-01"), active: true },
];

const COLUMNS: readonly OcadeTableColumn<Person>[] = [
  { key: "name", label: "Name", required: true, value: (row) => row.name },
  { key: "seats", label: "Seats", value: (row) => row.seats },
  { key: "joined", label: "Joined", sort: "date", value: (row) => row.joined },
  { key: "active", label: "Active", sort: "boolean", value: (row) => row.active },
];

/*
 * Interaction helpers built on `fireEvent` rather than `user-event`.
 *
 * `user-event` is not a dependency of this repository and this component does
 * not need what it adds: nothing here depends on pointer-down/up ordering or on
 * typing character by character, and adding a test library to prove a table
 * sorts would be a dependency bought for convenience.
 *
 * Each helper is wrapped in `act` so React has flushed the state update before
 * the assertion reads the DOM.
 */
async function click(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function select(element: Element, value: string): Promise<void> {
  await act(async () => {
    fireEvent.change(element, { target: { value } });
  });
}

async function type(element: Element, value: string): Promise<void> {
  await act(async () => {
    fireEvent.change(element, { target: { value } });
  });
}

async function press(element: Element, key: string): Promise<void> {
  await act(async () => {
    fireEvent.keyDown(element, { key });
  });
}

/** The first cell of every body row, in the order the table renders them. */
function rowNames(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent?.trim() ?? "");
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("sorting", () => {
  it("tells assistive technology which column is sorted and which way", async () => {
    // aria-sort on the header cell is the ONLY way a screen reader learns this.
    // The control it replaced — a <select> of column names — announced nothing.
    render(<OcadeDataTable<Person> caption="People" columns={COLUMNS} rows={PEOPLE} />);

    const header = screen.getAllByRole("columnheader")[0];
    expect(header.getAttribute("aria-sort")).toBe("none");

    await click(within(header).getByRole("button", { name: /Name/ }));
    expect(screen.getAllByRole("columnheader")[0].getAttribute("aria-sort")).toBe("ascending");

    await click(within(screen.getAllByRole("columnheader")[0]).getByRole("button"));
    expect(screen.getAllByRole("columnheader")[0].getAttribute("aria-sort")).toBe("descending");
  });

  it("actually reorders the rows, and reverses them", async () => {
    render(<OcadeDataTable<Person> caption="People" columns={COLUMNS} rows={PEOPLE} />);

    await click(screen.getByRole("button", { name: /Name/ }));
    expect(rowNames()).toEqual(["Ada", "Alan", "Grace"]);

    await click(screen.getByRole("button", { name: /Name/ }));
    expect(rowNames()).toEqual(["Grace", "Alan", "Ada"]);
  });

  it("sorts a numeric column numerically rather than as text", async () => {
    // The bug this catches on screen: 10 sorting before 9.
    render(<OcadeDataTable<Person> caption="People" columns={COLUMNS} rows={PEOPLE} />);
    await click(screen.getByRole("button", { name: /Seats/ }));
    expect(rowNames()).toEqual(["Alan", "Ada", "Grace"]);
  });

  it("sorts a date column chronologically", async () => {
    render(<OcadeDataTable<Person> caption="People" columns={COLUMNS} rows={PEOPLE} />);
    await click(screen.getByRole("button", { name: /Joined/ }));
    expect(rowNames()).toEqual(["Grace", "Ada", "Alan"]);
  });
});

describe("searching, filtering and the range it reports", () => {
  it("narrows the rows and says how many of how many are showing", async () => {
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        defaultPageSize={25}
      />,
    );
    expect(screen.getByText(/Showing 1–3 of 3/)).toBeTruthy();

    await type(screen.getByLabelText("Search table"), "ada");
    expect(rowNames()).toEqual(["Ada"]);
    expect(screen.getByText(/Showing 1–1 of 1/)).toBeTruthy();
  });

  it("offers a chip for every active narrowing, and clears them", async () => {
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        filters={[
          {
            id: "active",
            label: "Active",
            options: [
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ],
            test: (row, value) => (value === "yes" ? row.active : !row.active),
          },
        ]}
      />,
    );

    await select(screen.getByLabelText("Active"), "no");
    expect(rowNames()).toEqual(["Grace"]);
    expect(screen.getByRole("button", { name: /Active: No/ })).toBeTruthy();

    await click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowNames()).toHaveLength(3);
  });

  it("says something different when a search found nothing than when there is nothing", () => {
    // "No rows match this search" in front of a person who has not searched is
    // an accusation rather than an explanation.
    render(<OcadeDataTable<Person> caption="People" columns={COLUMNS} rows={[]} />);
    expect(screen.getAllByText("There is nothing here yet.").length).toBeGreaterThan(0);
  });
});

describe("paging", () => {
  it("pages, and reports the range of the page it is on", async () => {
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        defaultPageSize={5}
        pageSizeOptions={[2, 5]}
      />,
    );
    await select(screen.getByLabelText("Rows per page"), "2");
    expect(screen.getByText(/Showing 1–2 of 3/)).toBeTruthy();

    await click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText(/Showing 3–3 of 3/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("selection and bulk actions", () => {
  it("hands a bulk action exactly the rows that were selected", async () => {
    const archive = vi.fn();
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        selectable
        bulkActions={[{ label: "Archive", run: archive }]}
      />,
    );

    const table = screen.getByRole("table");
    const boxes = within(table).getAllByRole("checkbox");
    // boxes[0] is the select-all-on-this-page header control.
    await click(boxes[1]);
    await click(boxes[3]);
    await click(screen.getByRole("button", { name: "Archive" }));

    expect(archive).toHaveBeenCalledTimes(1);
    expect(archive.mock.calls[0][0].map((row: Person) => row.name)).toEqual(["Ada", "Alan"]);
  });

  it("selects and clears every row on the page from the header control", async () => {
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        selectable
        defaultPageSize={2}
        pageSizeOptions={[2]}
      />,
    );
    await click(screen.getByLabelText(/Select all 2 rows on this page/));
    expect(screen.getByText(/^2 selected/)).toBeTruthy();
    await click(screen.getByLabelText(/Select all 2 rows on this page/));
    expect(screen.getByText(/^0 selected/)).toBeTruthy();
  });

  it("does not offer 'select all matching' in server mode with no way to ask the server", () => {
    // The alternative is a button that claims to select every matching row and
    // silently selects one page.
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        selectable
        server={{
          total: 500,
          page: 1,
          pageSize: 3,
          sort: null,
          query: "",
          filters: {},
          onChange: () => undefined,
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /Select all 500 matching/ })).toBeNull();
  });

  it("offers it when the caller CAN enumerate the result set", async () => {
    const fetchAll = vi.fn(async () => PEOPLE);
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        selectable
        server={{
          total: 3,
          page: 1,
          pageSize: 3,
          sort: null,
          query: "",
          filters: {},
          onChange: () => undefined,
          fetchAll,
        }}
      />,
    );
    await click(screen.getByRole("button", { name: /Select all 3 matching/ }));
    expect(fetchAll).toHaveBeenCalled();
    expect(screen.getByText(/^3 selected/)).toBeTruthy();
  });
});

describe("column layout", () => {
  it("hides a column, keeps the identifying one, and remembers the choice", async () => {
    const { unmount } = render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        tableId="people"
        preferenceScope="account-1"
      />,
    );

    await click(screen.getByRole("button", { name: "Columns" }));
    // The identifying column cannot be hidden: a table of rows with no name is
    // a table nobody can read.
    expect((screen.getByRole("checkbox", { name: /Name/ }) as HTMLInputElement).disabled).toBe(
      true,
    );

    await click(screen.getByRole("checkbox", { name: "Seats" }));
    expect(screen.queryByRole("columnheader", { name: /Seats/ })).toBeNull();
    expect(readTablePreferences("account-1", "people", window.localStorage).hidden).toContain(
      "seats",
    );

    unmount();
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        tableId="people"
        preferenceScope="account-1"
      />,
    );
    expect(screen.queryByRole("columnheader", { name: /Seats/ })).toBeNull();
  });

  it("still renders the identifying column when storage says to hide it", () => {
    /*
     * The disabled checkbox is one layer, and it is the weakest one: a saved
     * layout is writable from developer tools and outlives a change to which
     * column is the identifying one. This is the layer that decides what is
     * actually drawn — a table whose rows have no name is a table nobody can
     * read, however it got that way.
     */
    window.localStorage.setItem(
      "ocade.table.account-1.people",
      JSON.stringify({ hidden: ["name", "seats"], order: [], pageSize: 10 }),
    );
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        tableId="people"
        preferenceScope="account-1"
      />,
    );
    expect(screen.queryByRole("columnheader", { name: /Name/ })).not.toBeNull();
    expect(screen.queryByRole("columnheader", { name: /Seats/ })).toBeNull();
  });

  it("keeps one account's layout away from another's on the same browser", async () => {
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        tableId="people"
        preferenceScope="account-1"
      />,
    );
    await click(screen.getByRole("button", { name: "Columns" }));
    await click(screen.getByRole("checkbox", { name: "Seats" }));
    cleanup();

    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={PEOPLE}
        tableId="people"
        preferenceScope="account-2"
      />,
    );
    expect(screen.queryByRole("columnheader", { name: /Seats/ })).not.toBeNull();
  });

  it("says plainly when a layout is not being saved", async () => {
    render(<OcadeDataTable<Person> caption="People" columns={COLUMNS} rows={PEOPLE} />);
    await click(screen.getByRole("button", { name: "Columns" }));
    expect(screen.getByText(/It is not saved/)).toBeTruthy();
  });
});

describe("states that are not rows", () => {
  it("shows an error with a way back, instead of an empty table", async () => {
    const retry = vi.fn();
    render(
      <OcadeDataTable<Person>
        caption="People"
        columns={COLUMNS}
        rows={[]}
        error="Accounts could not be loaded."
        onRetry={retry}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Accounts could not be loaded.");
    await click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });

  it("announces that it is loading rather than showing an empty result", () => {
    render(<OcadeDataTable<Person> caption="People" columns={COLUMNS} rows={[]} loading />);
    expect(screen.getAllByText(/Loading rows/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("There is nothing here yet.")).toBeNull();
  });
});

describe("announcements", () => {
  it("announces a sort change in a live region", async () => {
    const { container } = render(
      <OcadeDataTable<Person> caption="People" columns={COLUMNS} rows={PEOPLE} />,
    );
    const live = container.querySelector('[role="status"][aria-live="polite"]');
    expect(live).not.toBeNull();
    await click(screen.getByRole("button", { name: /Seats/ }));
    expect(live?.textContent).toContain("Sorted by Seats, ascending.");
  });
});

describe("keyboard", () => {
  it("moves between rows with the arrow keys and selects with space", async () => {
    render(<OcadeDataTable<Person> caption="People" columns={COLUMNS} rows={PEOPLE} selectable />);
    const bodyRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);

    bodyRows[0].focus();
    await press(bodyRows[0], "ArrowDown");
    expect(document.activeElement).toBe(bodyRows[1]);
    await press(bodyRows[1], "End");
    expect(document.activeElement).toBe(bodyRows[2]);
    await press(bodyRows[2], " ");
    expect(screen.getByText(/^1 selected/)).toBeTruthy();
  });
});
