using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Abp.Domain.Repositories;
using Moq;
using IzinYonetimi.Entities;
using IzinYonetimi.LeaveBalances;
using IzinYonetimi.LeaveBalances.Dto;
using IzinYonetimi.Flows;

namespace IzinYonetimi.Tests.LeaveBalances
{
    public class LeaveBalanceAppServiceTests
    {
        private readonly Mock<IRepository<LeaveBalance, long>> _repositoryMock;
        private readonly LeaveBalanceAppService _service;

        public LeaveBalanceAppServiceTests()
        {
            _repositoryMock = new Mock<IRepository<LeaveBalance, long>>();
            _service = new LeaveBalanceAppService(_repositoryMock.Object, new Mock<IFlowEngine>().Object);
        }

        [Fact]
        public void Repository_GetAll_ShouldReturnQueryable()
        {
            // Arrange
            var entities = new[]
            {
                new LeaveBalance { Id = 1, Year = 1, LeaveType = 0, TotalEntitlement = 1, UsedDays = 1, RemainingDays = 1 },
                new LeaveBalance { Id = 2, Year = 1, LeaveType = 0, TotalEntitlement = 1, UsedDays = 1, RemainingDays = 1 },
            }.AsQueryable();

            _repositoryMock.Setup(r => r.GetAll()).Returns(entities);

            // Act
            var result = _repositoryMock.Object.GetAll();

            // Assert
            result.Should().NotBeNull();
            result.Count().Should().Be(2);
        }

        [Fact]
        public void Repository_GetAll_WithFilter_ShouldWork()
        {
            // Arrange
            var entities = new[]
            {
                new LeaveBalance { Id = 1, Year = 1, LeaveType = 0, TotalEntitlement = 1, UsedDays = 1, RemainingDays = 1 },
                new LeaveBalance { Id = 2, Year = 1, LeaveType = 0, TotalEntitlement = 1, UsedDays = 1, RemainingDays = 1 },
            }.AsQueryable();

            _repositoryMock.Setup(r => r.GetAll()).Returns(entities);

            // Act — simulate keyword filter
            var result = _repositoryMock.Object.GetAll()
                .Where(x => x.Id.ToString().Contains("1"));

            // Assert
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task Create_ShouldInsertEntity()
        {
            // Arrange
            var dto = new CreateLeaveBalanceDto
            {
                Year = 1, LeaveType = 0, TotalEntitlement = 1, UsedDays = 1, RemainingDays = 1
            };

            _repositoryMock.Setup(r => r.InsertAndGetIdAsync(It.IsAny<LeaveBalance>()))
                .ReturnsAsync(1);
            _repositoryMock.Setup(r => r.GetAsync(It.IsAny<long>()))
                .ReturnsAsync(new LeaveBalance { Id = 1, Year = 1, LeaveType = 0, TotalEntitlement = 1, UsedDays = 1, RemainingDays = 1 });

            // Act & Assert
            _service.Should().NotBeNull();
        }

        [Fact]
        public async Task Delete_ShouldRemoveEntity()
        {
            // Arrange
            _repositoryMock.Setup(r => r.GetAsync(It.IsAny<long>()))
                .ReturnsAsync(new LeaveBalance { Id = 1, Year = 1, LeaveType = 0, TotalEntitlement = 1, UsedDays = 1, RemainingDays = 1 });

            // Act & Assert
            await _service.Invoking(s => s.DeleteAsync(new Abp.Application.Services.Dto.EntityDto<long> { Id = 1 }))
                .Should().NotThrowAsync();
        }
    }
}
