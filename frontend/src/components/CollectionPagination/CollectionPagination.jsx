import ReactPaginate from "react-paginate";

function CollectionPagination({ total, limit, page, onPageChange, disabled = false }) {
  const pageCount = Math.ceil(total / limit);
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Collection pagination" aria-busy={disabled}>
      <ReactPaginate
        pageCount={pageCount}
        forcePage={page}
        onPageChange={({ selected }) => onPageChange(selected)}
        onClick={() => disabled ? false : undefined}
        disableInitialCallback
        pageRangeDisplayed={3}
        marginPagesDisplayed={1}
        previousLabel="Previous"
        nextLabel="Next"
        breakLabel="…"
        containerClassName="pagination pagination-sm"
        activeClassName="active"
        disabledClassName="disabled"
        pageClassName="page-item"
        pageLinkClassName="page-link"
        previousClassName="page-item"
        previousLinkClassName="page-link"
        nextClassName="page-item"
        nextLinkClassName="page-link"
        breakClassName="page-item"
        breakLinkClassName="page-link"
      />
    </nav>
  );
}

export default CollectionPagination;
