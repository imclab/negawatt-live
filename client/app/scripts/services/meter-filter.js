'use strict';

angular.module('negawattClientApp')
  .factory('MeterFilter', function ($filter, $state, $stateParams, $rootScope, $injector, Utils) {

    return {
      filters: {},
      /**
       * Filter meters by category.
       *
       * @param meters
       *  The meters colection.
       *
       * @returns {*}
       *  The meters collection filteref by category.
       */
      byCategory: function(meters) {
        meters = Utils.toArray(meters.listAll);

        return Utils.indexById($filter('filter')(meters, function filterByCategory(meter) {
          // Return meters.
          if (!this.filters.category || meter.meter_categories && meter.meter_categories[this.filters.category]) {
            return meter;
          }
        }.bind(this), true));
      },
      byCategoryFilters: function(meters) {
        meters = Utils.toArray(meters.listAll);

        meters = $filter('filterMeterByCategories')(meters, getCategoriesChecked.bind(this)(), this.isDefine('categorized'));

        return meters;
      },
      /**
       * Return if need it, to show checkboxes to filter meter by categories.
       *
       * @returns {boolean}
       */
      showCategoryFilters: function() {
        var showControls = false;
        if ($state.is('dashboard.withAccount') || $state.is('dashboard.withAccount.markers')) {
          showControls = true;
        }
        return showControls;
      },
      /**
       * Clear the all the filters for the meters and also
       */
      clear: function() {
        this.clearMeterSelection();
        $stateParams.chartNextPeriod = undefined;
        $stateParams.chartPreviousPeriod = undefined;

        // Clear all the filters.
        this.filters = {};
      },
      /**
       * Return meter saved in the meter filters service.
       *
       * @returns {*|undefined}
       */
      getMeterSelected: function() {
        return this.filters.meterSelected || undefined;
      },
      /**
       * Save in the meter filters service, the meter selected.
       *
       * @param meter
       *  The meter object.
       */
      setMeterSelected: function(meter) {
        this.filters.meterSelected = meter;
      },
      /**
       * Clear the meter selection saved.
       */
      clearMeterSelection: function() {
        if (angular.isDefined(this.filters.meterSelected)) {
          this.filters.meterSelected.unselect();
        }

        //Clear filters.
        this.filters.meterSelected = undefined;
        this.filters.meter = undefined;
      },
      /**
       * Extend the categories with the category filters.
       *
       * @param categories
       *  The category tree object, used by the menu.
       *
       * @returns {*}
       *  The category tre object with category filters updated.
       */
      refreshCategoriesFilters: function(categories) {
        // Get category filters.
        var categorized = this.get('categorized');

        // Extend object categories.
        categories.$$extendWithFilter = $$extendWithFilter;

        return categorized && categories.$$extendWithFilter(categorized) || categories;
      },
      /**
       * Return if is defined a filter.
       *
       * @param name {string}
       *   The name of the filter.
       */
      isDefine: function(name) {
        var isDefined = !!this.filters[name];

        if (angular.isArray(this.filters[name])) {
          isDefined = !!this.filters[name].length;
        }

        return isDefined;
      },
      set: function(name, value) {
        // Extra task if is the filter categorized.
        if (name === 'categorized') {
          // Use angular copy to decopling from the category cache.
          setCategorized.bind(this, name, angular.copy(value))();
          return;
        }

        this.filters[name] = value;
      },
      get: function(name) {
        return this.filters && this.filters[name];
      }
    };

    /**
     * Set the states of the filter checkoxes control.
     *
     * @param name
     *  The name of the filter.
     * @param value {Array[{*}]|{*}}
     *  The categories collection or the object with the value update.
     */
    function setCategorized(name, value) {
      // Get categories object.
      var categories = getCategories(value);

      // Define the initial object or update a specific category.
      categories = (angular.isArray(categories)) ? getCategoriesWithMeters(categories) : getCategoriesWithCategoryUpdate.bind(this, value)();

      this.filters[name] = categories;

      // Add extra methods to the object
      addMethodsCategorized(this.filters[name]);
    }

    /**
     * Add extra method to handle the array of filter of categories.
     *
     * @param categories
     *  The filters category collection.
     */
    function addMethodsCategorized(categories) {
      categories.getCategoryFilter = getCategoryFilter;
      angular.forEach(categories, function(category) {
        if (category.children) {
          addMethodsCategorized(category.children);
        }
      });
    }

    /**
     * Return collection of categories.
     *
     * @param value
     *  Thae category object.
     */
    function getCategories(value) {
      return value['tree'] || value;
    }

    /**
     * Return the categories with meters associed.
     *
     * @param categories
     *  The category collection.
     * @returns {*}
     *  The categories where the property meters is different
     */
    function getCategoriesWithMeters(categories) {

      angular.forEach(categories, function(category, index) {
        // Get subcategories with meters.
        category.children = category.children && getCategoriesWithMeters(category.children);

        // Redefine the category filter object.
        categories[index] = refineToCategoryFilter(category);
      });

      return categories;
    }

    /**
     * Return an object with the necesary properties to keep the value.
     *
     * @param category
     * @returns {{id: *, label: *, children: *}}
     */
    function refineToCategoryFilter(category) {
      return {
        id: category.id,
        label: category.label,
        children: category.children,
        checked: true,
        indeterminate: false
      };
    }

    /**
     * Return Categories with the checked property udpated.
     *
     * @param value {id: boolean}
     *  Object indicate what item of categories have to update the property
     *  checked.
     * @param categories
     *  Categories
     * @returns {*}
     */
    function getCategoriesWithCategoryUpdate(value, categories) {
      if (angular.isUndefined(categories)) {
        categories = this.get('categorized');
      }

      angular.forEach(categories, function(category, index) {
        if (category.id === +Object.keys(value)) {
          category.checked = value[category.id];

          if (category.children) {
            // Set the unchecked|checked also the category children.
            setCategoryChildren(category.children, value[category.id]);
          }
        }

        // Look up into the category children.
        if (category.children) {
          categories[index].children = getCategoriesWithCategoryUpdate(value, category.children);

          // Remove parent selection if is children have indeterminate state.
          if (getChildrenCheckedState(category.children) === 'indeterminate') {
            categories[index].checked = false;
          }
        }

      }, categories);

      return categories;
    }

    /**
     * Return the state of checked property of all children, true, false
     * or indeterminate.
     *
     * @param categories
     *  Collection of categories.
     *
     * @returns {*}
     *  The checked
     */
    function getChildrenCheckedState(categories) {
      var state;

      // Clone categories to avoid side effect.
      categories = angular.copy(categories);

      // Cast the meters ammount to string, need it to the $filter service.
      if (angular.isNumber(categories[0].meters)) {
        categories = categories.map(function(category) {
          category.meters = category.meters.toString();
          return category;
        });
      }
      categories = $filter('filter')(categories, {meters: "!0"}, true);

      // Determine the 'checked' state.
      angular.forEach(categories, function(category) {
        state = (state !== category.checked && angular.isDefined(state) || state === 'indeterminate') ? 'indeterminate' : category.checked;
      });

      return state;
    }

    /**
     * Set the property 'checked' true|false
     *
     * @param categories
     *  Collection of categories.
     * @param value
     *  Boolean value indicate when is checked.
     */
    function setCategoryChildren(categories, value) {
      angular.forEach(categories, function(category, index) {
        category.checked = value;

        if (category.children) {
          setCategoryChildren(category.children, value);
        }
      });
    }

    /**
     * Update property checked of the children with the value of the parent.
     *
     * @param value
     *  Value set in the cheked property of the parent. boolean
     */
    function getUpdatedCategoryChildren(category, value) {
      var children = getCategoryChildren.bind($injector.get('MeterFilter'), category.id);

      angular.forEach(children, function(category) {
        category.checked = value;
      });

      return children;
    }

    /**
     * Returns a boolen, true to indicate that subcategories have property
     * checked  in diferent states each one 'true' or 'false'. otherwise
     * return false.
     *
     * @param categoryId
     *  The category id.
     */
    function isInderminate(categoryId) {
      var children = getCategoryChildren.bind($injector.get('MeterFilter'), categoryId)();

      return (!children) ? false : categoriesWithMultiplesStates(children);
    };

    /**
     * Returns the children of a specific category.
     *
     * @param categoryId
     * @returns {Array|children|Function|*|{}}
     */
    function getCategoryChildren(categoryId, categories) {
      var children;
      categories = categories || this.get('categorized');

      angular.forEach(categories, function(category) {
        if (category.id === categoryId) {
          children = category.children;
        }

        if (category.children) {
          children = children || getCategoryChildren(categoryId, category.children);
        }
      });

      return children;
    }

    /**
     * Returns a boolen, true to indicate that subcategories have property
     * checked  in diferent states each one 'true' or 'false'. otherwise
     * return false.
     *
     * @param categories
     *  The category list, could be only a subset of the category object.
     */
    function categoriesWithMultiplesStates(categories) {
      var stateChanges=0;
      var lastState;

      angular.forEach(categories, function(category) {
        if (category.checked !== lastState) {
          lastState = category.checked;
          stateChanges++;
        }
      });

      return (stateChanges !== 1 && categories.length > 1) ? true : false;
    }

    /**
     * Return from category filters a category with the id indicated.
     * otherwise, undefined.
     *
     * @param id
     *  The category id
     * @returns {*}
     *  The category filter information.
     */
    function getCategoryFilter(id) {
      var categoryFilter;

      angular.forEach(this, function(category) {
        if (category.id === id) {
          categoryFilter = category;
        }

        if (category.children && angular.isUndefined(categoryFilter)) {
          categoryFilter = category.children.getCategoryFilter(id)
        }

      });

      return categoryFilter;
    }

    /**
     * Return an array of the category ids, checked.
     *
     * @returns {Array}
     */
    function getCategoriesChecked(categories) {
      var filter = [];
      var categories = categories || this.get('categorized');
      // Return filter object.
      angular.forEach(categories, function(category) {

        if (category.checked) {
          filter.push(category.id);
        }

        if (category.children) {
          filter = filter.concat(getCategoriesChecked(category.children));
        }
      });

      return filter;
    }

    /**
     * Method that extend the category tree object, to extend it with their
     * filters.
     *
     * @param category
     *  The category filters.
     */
    function $$extendWithFilter(categoriesFilters, categories) {
      categories = categories || this;

      // Refresh only categories with meters.
      angular.forEach(categories, function(category, index) {
        var childrenCheckedState;
        var categoryFilter = categoriesFilters.getCategoryFilter(category.id);
        // hasCategoryFilters
        if (angular.isDefined(categoryFilter)) {
          // Keep meters (in this category), and children from the original
          // category object. Important for the lazyload data.
          angular.extend(categories[index], categoryFilter, {
            meters: category.meters,
            children: category.children
          });
          categories[index].indeterminate = isInderminate(category.id);

          // Check if the children have tha same 'checked' value.
          if (category.children) {
            childrenCheckedState = getChildrenCheckedState(category.children);
            if (childrenCheckedState !== 'indeterminate') {
              categories[index].checked = childrenCheckedState;
              categories[index].indeterminate = false;
            }
          }
        }

        if (category.children) {
          categories[index].children = $$extendWithFilter(categoriesFilters, category.children);
        }
      });

      return categories;
    }

  });
